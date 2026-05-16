export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Listener = () => void;

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredInstallPrompt;
}

export function setDeferredInstallPrompt(event: BeforeInstallPromptEvent | null) {
  deferredInstallPrompt = event;
  notifyListeners();
}

export function subscribeInstallPrompt(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function promptToInstallApp() {
  if (!deferredInstallPrompt) {
    return false;
  }

  const promptEvent = deferredInstallPrompt;
  try {
    await promptEvent.prompt();
    setDeferredInstallPrompt(null);
    return true;
  } catch (error) {
    console.error("PWA install prompt invocation failed:", error);
    return false;
  }
}
