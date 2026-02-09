import "@/styles/globals.css";
import type { AppProps } from "next/app";
import InteractiveBackground from '../components/InteractiveBackground';
import PrivyWrapper from '../providers/PrivyWrapper';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PrivyWrapper>
      <InteractiveBackground />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Component {...pageProps} />
      </div>
    </PrivyWrapper>
  );
}
