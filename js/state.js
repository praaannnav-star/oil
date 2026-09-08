// Central Application State Store with Auth Session Integration
import { Auth } from './services/auth.js';

class StateStore {
  constructor() {
    this.state = {
      currentUser: Auth.getUser(),
      currentProjectId: 'PRJ-OIL-DUL-001',
      currentRoute: '/overview',
      connectionStatus: 'online',
      pendingCount: 0,
      filters: {
        discipline: 'All',
        status: 'All',
        search: ''
      }
    };
    this.listeners = new Set();

    // Listen to Auth state updates
    Auth.subscribe((user) => {
      this.setState({ currentUser: user });
    });
  }

  getState() {
    return this.state;
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  setRole(role) {
    if (this.state.currentUser) {
      this.setState({
        currentUser: {
          ...this.state.currentUser,
          role
        }
      });
    }
  }

  setUser(user) {
    this.setState({ currentUser: user });
  }

  setProject(projectId) {
    this.setState({ currentProjectId: projectId });
  }

  setRoute(route) {
    this.setState({ currentRoute: route });
  }

  setConnectionStatus(status) {
    this.setState({ connectionStatus: status });
  }

  setPendingCount(count) {
    this.setState({ pendingCount: count });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(l => l(this.state));
  }
}

export const State = new StateStore();
