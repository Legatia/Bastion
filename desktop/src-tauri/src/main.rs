// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod modules;

use modules::openclaw::{install_openclaw, run_openclaw, stop_openclaw, save_config, OpenClawState};
use modules::bastion::{start_bastion_proxy, stop_bastion_proxy, get_bastion_status, BastionState};
use modules::identity::{check_identity_status, verify_identity};
use modules::moltmind::{start_moltmind, stop_moltmind, get_moltmind_status, get_behavior_events, MoltMindState};
use modules::billing::{sync_billing, get_active_modules, check_module_access, activate_module, get_billing_summary};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_deep_link::DeepLinkExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .manage(OpenClawState::new())
        .manage(BastionState::new())
        .manage(MoltMindState::new())
        .setup(|app| {
            #[cfg(desktop)]
            app.deep_link().register_all()?;

            // Create tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let proxy_item = MenuItem::with_id(app, "toggle_proxy", "Toggle Proxy", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Bastion", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_item, &proxy_item, &quit_item])?;
            
            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "toggle_proxy" => {
                            // Emit event to frontend to toggle proxy
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("tray-toggle-proxy", ());
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
                
            Ok(())
        })
        .on_window_event(|window, event| {
            // Minimize to tray instead of closing
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            install_openclaw, run_openclaw, stop_openclaw, save_config,
            start_bastion_proxy, stop_bastion_proxy, get_bastion_status,
            verify_identity, check_identity_status,
            start_moltmind, stop_moltmind, get_moltmind_status, get_behavior_events,
            sync_billing, get_active_modules, check_module_access, activate_module, get_billing_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

