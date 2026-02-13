import "@/styles/globals.css";
import type { AppProps } from "next/app";
import InteractiveBackground from '../components/InteractiveBackground';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <InteractiveBackground />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Component {...pageProps} />
      </div>
    </>
  );
}
