
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    name?: string;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-800 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold mb-1">Algo deu errado {this.props.name ? `em ${this.props.name}` : ""}</h3>
                        <p className="text-sm opacity-90 mb-2">
                            Um erro inesperado ocorreu ao carregar este componente.
                        </p>
                        {this.state.error && (
                            <pre className="text-xs bg-red-100 p-2 rounded overflow-auto max-w-lg">
                                {this.state.error.message}
                            </pre>
                        )}
                        <button
                            onClick={() => this.setState({ hasError: false })}
                            className="text-xs font-medium underline hover:no-underline mt-2"
                        >
                            Tentar novamente
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
