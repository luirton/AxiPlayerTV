type Listener = (val: boolean) => void;

class UIState {
  private isFullscreen = false;
  private listeners: Listener[] = [];

  setFullscreen(val: boolean) {
    this.isFullscreen = val;
    this.listeners.forEach((l) => l(val));
  }

  getFullscreen() {
    return this.isFullscreen;
  }

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const uiState = new UIState();
