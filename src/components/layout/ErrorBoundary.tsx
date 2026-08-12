import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-dvh text-center p-8 bg-background">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">页面出现错误</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            {this.state.error?.message || '未知错误'}
          </p>
          <div className="flex gap-3">
            <Button onClick={this.handleReset}>
              <RefreshCw className="h-4 w-4 mr-1" />
              重试
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              <Home className="h-4 w-4 mr-1" />
              返回首页
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
