import { useState } from "react";
import InstallWizard from "./components/InstallWizard";
import Dashboard from "./components/Dashboard";
import { Shield } from "lucide-react";
import "./App.css";

function App() {
  const [installed, setInstalled] = useState(false);

  if (!installed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <InstallWizard onComplete={() => setInstalled(true)} />
      </div>
    );
  }

  <main className="min-h-screen bg-zinc-950 text-white">
    <header className="h-16 border-b border-zinc-800 flex items-center px-6 bg-zinc-900/50 backdrop-blur-sm sticky top-0">
      <div className="flex items-center gap-3">
        <Shield className="text-blue-500" />
        <span className="font-bold text-lg">Bastion Suite</span>
      </div>
    </header>

    <Dashboard />
  </main>
}

export default App;
