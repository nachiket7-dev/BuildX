import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(
    previous: Readonly<{ children: ReactNode; resetKey?: string }>,
  ) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }
  render() {
    if (this.state.failed)
      return (
        <div className="route-loading" role="alert">
          <h1>This view couldn’t open</h1>
          <p>
            Your saved projects are still available. Try opening this view
            again.
          </p>
          <button
            className="ui-button ui-button--primary"
            onClick={() => this.setState({ failed: false })}
          >
            Try again
          </button>
          <a href="/gallery">Back to gallery</a>
        </div>
      );
    return this.props.children;
  }
}
