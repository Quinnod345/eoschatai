interface ConnectionPoolOptions {
  maxConnections: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

class ConnectionPool<T> {
  private pool: T[] = [];
  private activeConnections = new Map<string, T>();
  private pendingRequests: Array<{
    resolve: (conn: T) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(
    private createConnection: () => Promise<T>,
    private destroyConnection: (conn: T) => Promise<void>,
    private options: ConnectionPoolOptions = {
      maxConnections: 10,
      connectionTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    },
  ) {}

  async acquire(id: string): Promise<T> {
    // Check if already has active connection
    const existing = this.activeConnections.get(id);
    if (existing) {
      return existing;
    }

    // Try to get from pool
    let connection = this.pool.pop();

    if (!connection) {
      // Create new connection if under limit
      if (this.activeConnections.size < this.options.maxConnections) {
        connection = await this.createConnectionWithRetry();
      } else {
        // Wait for available connection
        connection = await this.waitForConnection();
      }
    }

    this.activeConnections.set(id, connection);
    return connection;
  }

  async release(id: string): Promise<void> {
    const connection = this.activeConnections.get(id);
    if (!connection) return;

    this.activeConnections.delete(id);

    // Give connection to pending request or return to pool
    const pending = this.pendingRequests.shift();
    if (pending) {
      pending.resolve(connection);
    } else if (this.pool.length < this.options.maxConnections) {
      this.pool.push(connection);
    } else {
      await this.destroyConnection(connection);
    }
  }

  private async createConnectionWithRetry(): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.options.retryAttempts; i++) {
      try {
        return await this.createConnection();
      } catch (error) {
        lastError = error as Error;
        if (i < this.options.retryAttempts - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.retryDelay * (i + 1)),
          );
        }
      }
    }

    throw lastError || new Error('Failed to create connection');
  }

  private waitForConnection(): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pendingRequests.findIndex(
          (req) => req.resolve === resolve,
        );
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
        }
        reject(new Error('Connection timeout'));
      }, this.options.connectionTimeout);

      this.pendingRequests.push({
        resolve: (conn: T) => {
          clearTimeout(timeout);
          resolve(conn);
        },
        reject,
      });
    });
  }

  async drain(): Promise<void> {
    // Reject all pending requests
    this.pendingRequests.forEach((req) =>
      req.reject(new Error('Connection pool draining')),
    );
    this.pendingRequests = [];

    // Destroy all connections
    const destroyPromises = [
      ...this.pool.map((conn) => this.destroyConnection(conn)),
      ...Array.from(this.activeConnections.values()).map((conn) =>
        this.destroyConnection(conn),
      ),
    ];

    await Promise.all(destroyPromises);
    this.pool = [];
    this.activeConnections.clear();
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      activeConnections: this.activeConnections.size,
      pendingRequests: this.pendingRequests.length,
      totalConnections: this.pool.length + this.activeConnections.size,
    };
  }
}

// Export singleton instance for WebSocket connections
export const wsConnectionPool = new ConnectionPool(
  async () => {
    // Create WebSocket connection
    const ws = new WebSocket(
      process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    );

    return new Promise<WebSocket>((resolve, reject) => {
      ws.onopen = () => resolve(ws);
      ws.onerror = (error) => reject(error);
    });
  },
  async (ws) => {
    ws.close();
  },
  {
    maxConnections: 5,
    connectionTimeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
);

// HTTP connection pooling for fetch
export const httpAgent = {
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 30000,
};
