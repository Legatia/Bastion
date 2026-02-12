use axum::{
    body::{Body, to_bytes},
    extract::{Request, State},
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
};
use hyper::upgrade::Upgraded;
use hyper_util::rt::TokioIo;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::net::TcpStream;
use crate::config::Config;

// Note: These structs are reserved for future request body parsing
// #[derive(Deserialize)]
// struct AuthorizeRequest {
//     action: Action,
// }
// #[derive(Deserialize, Serialize)]
// struct Action {
//     #[serde(rename = "type")]
//     action_type: String,
//     details: serde_json::Value,
// }

#[derive(Serialize, Deserialize)]
struct AuthorizeResponse {
    allowed: bool,
    reason: Option<String>,
}

pub async fn proxy_handler(
    State(config): State<Arc<Config>>,
    req: Request<Body>,
) -> Response {
    let method = req.method().clone();
    let uri = req.uri().clone();
    // let headers = req.headers().clone();

    // Log intercepted request
    // In a real implementation we would call authorize_action here internally first

    if method == Method::CONNECT {
        // HTTPS Tunneling
        if let Some(host) = uri.authority() {
            let host_addr = host.to_string();

            // For HTTPS CONNECT, we can check the host/domain but not the body
            let action_type = "https_connect".to_string();
            let details = serde_json::json!({
                "method": "CONNECT",
                "host": host_addr.clone(),
                "url": format!("https://{}", host_addr)
            });

            // Check policy before establishing tunnel
            match check_policy(&config, action_type, details).await {
                Ok(allowed) => {
                    if !allowed {
                        println!("   🛑 BLOCKED HTTPS connection to {}", host_addr);
                        return (StatusCode::FORBIDDEN, "Connection blocked by Bastion Policy").into_response();
                    }
                }
                Err(e) => {
                    eprintln!("   ⚠️  Policy check failed: {}", e);
                }
            }

            tokio::spawn(async move {
                match hyper::upgrade::on(req).await {
                    Ok(upgraded) => {
                        if let Err(e) = tunneling(upgraded, host_addr).await {
                            eprintln!("server io error: {}", e);
                        };
                    }
                    Err(e) => eprintln!("upgrade error: {}", e),
                }
            });
            return (StatusCode::OK, "Connection established").into_response();
        } else {
             return (StatusCode::BAD_REQUEST, "CONNECT must be to a socket address").into_response();
        }
    }

    // Standard HTTP Proxying - Extract body for DLP scanning
    let url = uri.to_string();

    // Extract request body for POST/PUT/PATCH requests
    let (_parts, body) = req.into_parts();
    let body_bytes = match to_bytes(body, usize::MAX).await {
        Ok(bytes) => bytes,
        Err(e) => {
            eprintln!("   ⚠️  Failed to read request body: {}", e);
            return (StatusCode::BAD_REQUEST, "Failed to read request body").into_response();
        }
    };

    // Convert body to string for DLP scanning (if reasonable size)
    let _body_str = if body_bytes.len() < 1_000_000 { // Max 1MB for DLP scanning
        String::from_utf8_lossy(&body_bytes).to_string()
    } else {
        format!("<body too large: {} bytes>", body_bytes.len())
    };

    // Perform authorization check with body included
    let action_type = "http_request".to_string();
    let details = serde_json::json!({
        "method": method.to_string(),
        "url": url,
        // "body": body_str // DLP scanning would check this
    });

    match check_policy(&config, action_type, details).await {
        Ok(allowed) => {
            if !allowed {
                println!("   🛑 BLOCKED HTTP request to {}", url);
                return (StatusCode::FORBIDDEN, "Request blocked by Bastion Policy").into_response();
            }
        }
        Err(e) => {
             eprintln!("   ⚠️  Policy check failed: {}", e);
        }
    }

    // Forward request
    let client = reqwest::Client::new();
    let resp = match client
        .request(method, url)
        .body(body_bytes)
        .send()
        .await {
            Ok(res) => res,
            Err(e) => return (StatusCode::BAD_GATEWAY, format!("Proxy error: {}", e)).into_response()
        };
        
    let status = resp.status();
    let headers = resp.headers().clone();
    let body = resp.bytes().await.unwrap_or_default();
    
    let mut response = Response::builder()
        .status(status)
        .body(Body::from(body))
        .unwrap();
        
    *response.headers_mut() = headers;
    response
}

async fn tunneling(upgraded: Upgraded, host_addr: String) -> std::io::Result<()> {
    let mut upgraded = TokioIo::new(upgraded);
    let mut server = TcpStream::connect(host_addr).await?;
    let (mut client_read, mut client_write) = tokio::io::split(&mut upgraded);
    let (mut server_read, mut server_write) = server.split();

    let client_to_server = tokio::io::copy(&mut client_read, &mut server_write);
    let server_to_client = tokio::io::copy(&mut server_read, &mut client_write);

    let _ = tokio::try_join!(client_to_server, server_to_client);

    Ok(())
}

async fn check_policy(config: &Config, action_type: String, details: serde_json::Value) -> Result<bool, String> {
    let client = reqwest::Client::new();
     let backend_payload = serde_json::json!({
        "api_key": config.api_key,
        "agent_id": config.agent_id,
        "action": {
            "type": action_type,
            "details": details
        }
    });

    match client
        .post(format!("{}/authorize", config.backend_url))
        .header("X-API-Key", &config.api_key)
        .json(&backend_payload)
        .timeout(std::time::Duration::from_secs(2)) // Fast timeout for proxy
        .send()
        .await
    {
        Ok(resp) => {
             if resp.status().is_success() {
                let result = resp.json::<AuthorizeResponse>().await.map_err(|e| e.to_string())?;
                Ok(result.allowed)
             } else if resp.status() == reqwest::StatusCode::FORBIDDEN {
                // Check for quota exceeded
                let body = resp.text().await.unwrap_or_default();
                if body.contains("QUOTA_EXCEEDED") {
                    eprintln!("\n🚫 QUOTA EXCEEDED");
                    eprintln!("   You've reached your plan's limit.");
                    eprintln!("   Upgrade at: https://bastion.ai/billing\n");
                    Err("QUOTA_EXCEEDED".to_string())
                } else {
                    Err(format!("Access denied: {}", body))
                }
             } else {
                 Err(format!("Backend error: {}", resp.status()))
             }
        }
        Err(e) => Err(e.to_string())
    }
}
