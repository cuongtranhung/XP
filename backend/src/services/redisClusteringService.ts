/**
 * Redis Clustering Simulation Service
 * Simulates Redis cluster behavior for distributed cache testing
 */

import cacheService from './cacheService';
import { logger } from '../utils/logger';

// Clustering types and interfaces
export interface ClusterNode {
  nodeId: string;
  host: string;
  port: number;
  isMaster: boolean;
  slotRange: { start: number; end: number };
  replicas: string[];
  status: 'connected' | 'disconnected' | 'reconnecting' | 'failed';
  lastHeartbeat: Date;
  memoryUsage: number;
  keyCount: number;
  operationsPerSecond: number;
  latency: number;
}

export interface ClusterConfig {
  nodeCount: number;
  replicationFactor: number;
  shardingStrategy: 'consistent-hash' | 'range-based' | 'virtual-nodes';
  enableFailover: boolean;
  heartbeatInterval: number;
  failureDetectionTimeout: number;
  replicationMode: 'async' | 'sync';
  loadBalancing: 'round-robin' | 'least-connections' | 'weighted-random';
}

export interface ClusterMetrics {
  totalNodes: number;
  activeNodes: number;
  failedNodes: number;
  totalMemoryUsage: number;
  totalKeyCount: number;
  averageLatency: number;
  totalOperationsPerSecond: number;
  replicationHealth: number;
  shardDistribution: Array<{
    nodeId: string;
    keyCount: number;
    memoryUsage: number;
    load: number;
  }>;
}

export interface ShardingResult {
  targetNode: string;
  slot: number;
  replicationNodes: string[];
}

/**
 * Redis Clustering Simulation Service
 */
class RedisClusteringService {
  private clusterConfig: ClusterConfig;
  private nodes = new Map<string, ClusterNode>();
  private keyToNodeMapping = new Map<string, string>();
  private virtualNodes = new Map<string, string>(); // virtual node -> physical node
  private hashRing: Array<{ hash: number; nodeId: string }> = [];
  private operationLog: Array<{
    operation: string;
    key: string;
    nodeId: string;
    timestamp: Date;
    latency: number;
    success: boolean;
  }> = [];

  // Cluster state
  private isInitialized = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private replicationTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.clusterConfig = {
      nodeCount: 6, // 3 masters + 3 replicas
      replicationFactor: 1,
      shardingStrategy: 'consistent-hash',
      enableFailover: true,
      heartbeatInterval: 5000, // 5 seconds
      failureDetectionTimeout: 15000, // 15 seconds
      replicationMode: 'async',
      loadBalancing: 'least-connections'
    };
  }

  /**
   * Initialize Redis cluster simulation
   */
  async initializeCluster(config?: Partial<ClusterConfig>): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Cluster is already initialized');
    }

    // Apply custom configuration
    if (config) {
      this.clusterConfig = { ...this.clusterConfig, ...config };
    }

    logger.info('Initializing Redis cluster simulation', {
      nodeCount: this.clusterConfig.nodeCount,
      replicationFactor: this.clusterConfig.replicationFactor,
      shardingStrategy: this.clusterConfig.shardingStrategy
    });

    // Create cluster nodes
    await this.createNodes();

    // Set up sharding
    await this.setupSharding();

    // Set up replication
    await this.setupReplication();

    // Start background processes
    this.startHeartbeat();
    this.startReplication();
    this.startMetricsCollection();

    this.isInitialized = true;

    logger.info('Redis cluster simulation initialized', {
      totalNodes: this.nodes.size,
      masterNodes: this.getMasterNodes().length,
      replicaNodes: this.getReplicaNodes().length
    });
  }

  /**
   * Get key from cluster
   */
  async clusterGet(key: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Cluster not initialized');
    }

    const startTime = Date.now();
    
    try {
      const shardResult = this.getShardForKey(key);
      const targetNode = this.nodes.get(shardResult.targetNode);
      
      if (!targetNode || targetNode.status !== 'connected') {
        // Try failover to replica
        const replicaNode = await this.handleFailover(shardResult.targetNode, 'get', key);
        if (replicaNode) {
          const result = await this.executeOperation(replicaNode.nodeId, 'get', key);
          this.logOperation('get', key, replicaNode.nodeId, Date.now() - startTime, true);
          return result;
        }
        throw new Error(`Target node ${shardResult.targetNode} is unavailable`);
      }

      const result = await this.executeOperation(targetNode.nodeId, 'get', key);
      this.logOperation('get', key, targetNode.nodeId, Date.now() - startTime, true);
      
      // Update node metrics
      targetNode.operationsPerSecond++;
      targetNode.latency = (targetNode.latency + (Date.now() - startTime)) / 2;

      return result;

    } catch (error) {
      this.logOperation('get', key, 'unknown', Date.now() - startTime, false);
      logger.error('Cluster get operation failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Set key in cluster
   */
  async clusterSet(key: string, value: any, options: any = {}): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Cluster not initialized');
    }

    const startTime = Date.now();
    
    try {
      const shardResult = this.getShardForKey(key);
      const targetNode = this.nodes.get(shardResult.targetNode);
      
      if (!targetNode || targetNode.status !== 'connected') {
        throw new Error(`Target node ${shardResult.targetNode} is unavailable`);
      }

      // Set on master node
      await this.executeOperation(targetNode.nodeId, 'set', key, value, options);
      
      // Store key mapping
      this.keyToNodeMapping.set(key, targetNode.nodeId);
      
      // Update node metrics
      targetNode.keyCount++;
      targetNode.memoryUsage += this.estimateMemoryUsage(value);
      targetNode.operationsPerSecond++;
      targetNode.latency = (targetNode.latency + (Date.now() - startTime)) / 2;

      // Replicate to replicas if configured
      if (this.clusterConfig.replicationMode === 'sync') {
        await this.replicateToReplicas(targetNode.nodeId, 'set', key, value, options);
      }

      this.logOperation('set', key, targetNode.nodeId, Date.now() - startTime, true);

    } catch (error) {
      this.logOperation('set', key, 'unknown', Date.now() - startTime, false);
      logger.error('Cluster set operation failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete key from cluster
   */
  async clusterDel(key: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Cluster not initialized');
    }

    const startTime = Date.now();
    
    try {
      const nodeId = this.keyToNodeMapping.get(key);
      if (!nodeId) {
        // Key doesn't exist
        this.logOperation('del', key, 'unknown', Date.now() - startTime, true);
        return;
      }

      const targetNode = this.nodes.get(nodeId);
      if (!targetNode || targetNode.status !== 'connected') {
        throw new Error(`Target node ${nodeId} is unavailable`);
      }

      await this.executeOperation(targetNode.nodeId, 'del', key);
      
      // Remove key mapping
      this.keyToNodeMapping.delete(key);
      
      // Update node metrics
      targetNode.keyCount--;
      targetNode.operationsPerSecond++;

      // Replicate deletion to replicas
      if (this.clusterConfig.replicationMode === 'sync') {
        await this.replicateToReplicas(targetNode.nodeId, 'del', key);
      }

      this.logOperation('del', key, targetNode.nodeId, Date.now() - startTime, true);

    } catch (error) {
      this.logOperation('del', key, 'unknown', Date.now() - startTime, false);
      logger.error('Cluster delete operation failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Simulate node failure
   */
  async simulateNodeFailure(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    logger.warn('Simulating node failure', { nodeId });
    
    node.status = 'failed';
    node.lastHeartbeat = new Date(Date.now() - this.clusterConfig.failureDetectionTimeout * 2);

    if (node.isMaster && this.clusterConfig.enableFailover) {
      await this.promoteReplica(nodeId);
    }
  }

  /**
   * Recover failed node
   */
  async recoverNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    logger.info('Recovering node', { nodeId });
    
    node.status = 'connected';
    node.lastHeartbeat = new Date();

    // If this was a master that was replaced, it becomes a replica
    if (node.isMaster && this.hasActiveMasterForSlots(node.slotRange)) {
      node.isMaster = false;
      logger.info('Recovered node demoted to replica', { nodeId });
    }
  }

  /**
   * Get cluster metrics
   */
  getClusterMetrics(): ClusterMetrics {
    const nodes = Array.from(this.nodes.values());
    const activeNodes = nodes.filter(node => node.status === 'connected');
    const failedNodes = nodes.filter(node => node.status === 'failed');

    const totalMemoryUsage = nodes.reduce((sum, node) => sum + node.memoryUsage, 0);
    const totalKeyCount = nodes.reduce((sum, node) => sum + node.keyCount, 0);
    const averageLatency = nodes.length > 0 ? 
      nodes.reduce((sum, node) => sum + node.latency, 0) / nodes.length : 0;
    const totalOperationsPerSecond = nodes.reduce((sum, node) => sum + node.operationsPerSecond, 0);

    const replicationHealth = this.calculateReplicationHealth();

    const shardDistribution = nodes.map(node => ({
      nodeId: node.nodeId,
      keyCount: node.keyCount,
      memoryUsage: node.memoryUsage,
      load: this.calculateNodeLoad(node)
    }));

    return {
      totalNodes: nodes.length,
      activeNodes: activeNodes.length,
      failedNodes: failedNodes.length,
      totalMemoryUsage,
      totalKeyCount,
      averageLatency,
      totalOperationsPerSecond,
      replicationHealth,
      shardDistribution
    };
  }

  /**
   * Rebalance cluster
   */
  async rebalanceCluster(): Promise<{
    keysRebalanced: number;
    duration: number;
    newDistribution: Array<{
      nodeId: string;
      keyCount: number;
      load: number;
    }>;
  }> {
    const startTime = Date.now();
    let keysRebalanced = 0;

    logger.info('Starting cluster rebalancing');

    // Get current load distribution
    const nodes = Array.from(this.nodes.values()).filter(node => node.status === 'connected');
    const averageLoad = nodes.reduce((sum, node) => sum + this.calculateNodeLoad(node), 0) / nodes.length;

    // Identify overloaded and underloaded nodes
    const overloadedNodes = nodes.filter(node => this.calculateNodeLoad(node) > averageLoad * 1.2);
    const underloadedNodes = nodes.filter(node => this.calculateNodeLoad(node) < averageLoad * 0.8);

    // Rebalance by moving keys from overloaded to underloaded nodes
    for (const overloadedNode of overloadedNodes) {
      const targetNode = underloadedNodes[0]; // Simple selection strategy
      if (!targetNode) continue;

      const keysToMove = Math.floor(overloadedNode.keyCount * 0.1); // Move 10% of keys
      let moved = 0;

      for (const [key, nodeId] of this.keyToNodeMapping.entries()) {
        if (nodeId === overloadedNode.nodeId && moved < keysToMove) {
          try {
            // Get value from source node
            const value = await this.executeOperation(overloadedNode.nodeId, 'get', key);
            
            // Set on target node
            await this.executeOperation(targetNode.nodeId, 'set', key, value);
            
            // Delete from source node
            await this.executeOperation(overloadedNode.nodeId, 'del', key);
            
            // Update mapping
            this.keyToNodeMapping.set(key, targetNode.nodeId);
            
            // Update metrics
            overloadedNode.keyCount--;
            targetNode.keyCount++;
            
            moved++;
            keysRebalanced++;
          } catch (error) {
            logger.error('Failed to move key during rebalancing', {
              key,
              sourceNode: overloadedNode.nodeId,
              targetNode: targetNode.nodeId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    const newDistribution = nodes.map(node => ({
      nodeId: node.nodeId,
      keyCount: node.keyCount,
      load: this.calculateNodeLoad(node)
    }));

    logger.info('Cluster rebalancing completed', {
      keysRebalanced,
      duration,
      nodesRebalanced: overloadedNodes.length
    });

    return {
      keysRebalanced,
      duration,
      newDistribution
    };
  }

  /**
   * Get cluster status
   */
  getClusterStatus(): {
    initialized: boolean;
    nodes: ClusterNode[];
    config: ClusterConfig;
    recentOperations: Array<{
      operation: string;
      key: string;
      nodeId: string;
      timestamp: Date;
      latency: number;
      success: boolean;
    }>;
  } {
    return {
      initialized: this.isInitialized,
      nodes: Array.from(this.nodes.values()),
      config: this.clusterConfig,
      recentOperations: this.operationLog.slice(-100)
    };
  }

  // Private helper methods

  private async createNodes(): Promise<void> {
    const masterCount = Math.ceil(this.clusterConfig.nodeCount / (1 + this.clusterConfig.replicationFactor));
    const totalSlots = 16384; // Redis cluster slots
    const slotsPerMaster = Math.floor(totalSlots / masterCount);

    // Create master nodes
    for (let i = 0; i < masterCount; i++) {
      const nodeId = `master_${i}`;
      const node: ClusterNode = {
        nodeId,
        host: `127.0.0.${i + 1}`,
        port: 7000 + i,
        isMaster: true,
        slotRange: {
          start: i * slotsPerMaster,
          end: i === masterCount - 1 ? totalSlots - 1 : (i + 1) * slotsPerMaster - 1
        },
        replicas: [],
        status: 'connected',
        lastHeartbeat: new Date(),
        memoryUsage: 0,
        keyCount: 0,
        operationsPerSecond: 0,
        latency: 0
      };
      this.nodes.set(nodeId, node);
    }

    // Create replica nodes
    let masterIndex = 0;
    for (let i = masterCount; i < this.clusterConfig.nodeCount; i++) {
      const nodeId = `replica_${i - masterCount}`;
      const masterNodeId = `master_${masterIndex}`;
      const masterNode = this.nodes.get(masterNodeId)!;

      const node: ClusterNode = {
        nodeId,
        host: `127.0.0.${i + 1}`,
        port: 7000 + i,
        isMaster: false,
        slotRange: masterNode.slotRange, // Replicas handle same slots as master
        replicas: [],
        status: 'connected',
        lastHeartbeat: new Date(),
        memoryUsage: 0,
        keyCount: 0,
        operationsPerSecond: 0,
        latency: 0
      };
      
      this.nodes.set(nodeId, node);
      masterNode.replicas.push(nodeId);

      masterIndex = (masterIndex + 1) % masterCount;
    }
  }

  private async setupSharding(): Promise<void> {
    switch (this.clusterConfig.shardingStrategy) {
      case 'consistent-hash':
        await this.setupConsistentHashing();
        break;
      case 'range-based':
        await this.setupRangeBasedSharding();
        break;
      case 'virtual-nodes':
        await this.setupVirtualNodeSharding();
        break;
    }
  }

  private async setupConsistentHashing(): Promise<void> {
    // Build hash ring
    for (const node of this.nodes.values()) {
      if (node.isMaster) {
        // Add multiple points on the ring for better distribution
        for (let i = 0; i < 160; i++) {
          const hash = this.hashFunction(`${node.nodeId}:${i}`);
          this.hashRing.push({ hash, nodeId: node.nodeId });
        }
      }
    }

    // Sort by hash value
    this.hashRing.sort((a, b) => a.hash - b.hash);
  }

  private async setupRangeBasedSharding(): Promise<void> {
    // Range-based sharding is already set up in slot ranges
    logger.debug('Range-based sharding configured based on slot ranges');
  }

  private async setupVirtualNodeSharding(): Promise<void> {
    const virtualNodeCount = 1000;
    const masterNodes = this.getMasterNodes();

    for (let i = 0; i < virtualNodeCount; i++) {
      const virtualNodeId = `virtual_${i}`;
      const physicalNode = masterNodes[i % masterNodes.length];
      this.virtualNodes.set(virtualNodeId, physicalNode.nodeId);
    }
  }

  private async setupReplication(): Promise<void> {
    // Replication is set up through the replica relationships created in createNodes
    logger.debug('Replication configured', {
      replicationFactor: this.clusterConfig.replicationFactor,
      replicationMode: this.clusterConfig.replicationMode
    });
  }

  private getShardForKey(key: string): ShardingResult {
    switch (this.clusterConfig.shardingStrategy) {
      case 'consistent-hash':
        return this.getConsistentHashShard(key);
      case 'range-based':
        return this.getRangeBasedShard(key);
      case 'virtual-nodes':
        return this.getVirtualNodeShard(key);
      default:
        throw new Error(`Unknown sharding strategy: ${this.clusterConfig.shardingStrategy}`);
    }
  }

  private getConsistentHashShard(key: string): ShardingResult {
    const keyHash = this.hashFunction(key);
    
    // Find the first node with hash >= keyHash
    let targetNodeEntry = this.hashRing.find(entry => entry.hash >= keyHash);
    
    // If no node found, wrap around to the first node
    if (!targetNodeEntry) {
      targetNodeEntry = this.hashRing[0];
    }

    const targetNode = this.nodes.get(targetNodeEntry.nodeId)!;
    const slot = keyHash % 16384;

    return {
      targetNode: targetNode.nodeId,
      slot,
      replicationNodes: targetNode.replicas
    };
  }

  private getRangeBasedShard(key: string): ShardingResult {
    const slot = this.hashFunction(key) % 16384;
    
    for (const node of this.nodes.values()) {
      if (node.isMaster && slot >= node.slotRange.start && slot <= node.slotRange.end) {
        return {
          targetNode: node.nodeId,
          slot,
          replicationNodes: node.replicas
        };
      }
    }

    throw new Error(`No node found for slot ${slot}`);
  }

  private getVirtualNodeShard(key: string): ShardingResult {
    const virtualNodeId = `virtual_${this.hashFunction(key) % 1000}`;
    const physicalNodeId = this.virtualNodes.get(virtualNodeId)!;
    const physicalNode = this.nodes.get(physicalNodeId)!;
    const slot = this.hashFunction(key) % 16384;

    return {
      targetNode: physicalNodeId,
      slot,
      replicationNodes: physicalNode.replicas
    };
  }

  private async executeOperation(nodeId: string, operation: string, key?: string, value?: any, options?: any): Promise<any> {
    // Simulate network latency
    const latency = Math.random() * 10 + 1; // 1-11ms
    await new Promise(resolve => setTimeout(resolve, latency));

    switch (operation) {
      case 'get':
        return await cacheService.get(`${nodeId}:${key}`);
      case 'set':
        return await cacheService.set(`${nodeId}:${key}`, value, options);
      case 'del':
        return await cacheService.del(`${nodeId}:${key}`);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private async replicateToReplicas(masterNodeId: string, operation: string, key: string, value?: any, options?: any): Promise<void> {
    const masterNode = this.nodes.get(masterNodeId);
    if (!masterNode) return;

    const replicationPromises = masterNode.replicas.map(async replicaId => {
      try {
        await this.executeOperation(replicaId, operation, key, value, options);
      } catch (error) {
        logger.error('Replication failed', {
          masterNodeId,
          replicaId,
          operation,
          key,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await Promise.all(replicationPromises);
  }

  private async handleFailover(failedNodeId: string, operation: string, key: string): Promise<ClusterNode | null> {
    const failedNode = this.nodes.get(failedNodeId);
    if (!failedNode || failedNode.replicas.length === 0) {
      return null;
    }

    // Find a healthy replica
    for (const replicaId of failedNode.replicas) {
      const replica = this.nodes.get(replicaId);
      if (replica && replica.status === 'connected') {
        logger.info('Failover to replica', {
          failedNode: failedNodeId,
          replica: replicaId,
          operation
        });
        return replica;
      }
    }

    return null;
  }

  private async promoteReplica(failedMasterNodeId: string): Promise<void> {
    const failedMaster = this.nodes.get(failedMasterNodeId);
    if (!failedMaster || failedMaster.replicas.length === 0) {
      return;
    }

    // Find the best replica to promote (first healthy one for simplicity)
    const newMasterId = failedMaster.replicas.find(replicaId => {
      const replica = this.nodes.get(replicaId);
      return replica && replica.status === 'connected';
    });

    if (!newMasterId) {
      logger.error('No healthy replica found for promotion', { failedMasterNodeId });
      return;
    }

    const newMaster = this.nodes.get(newMasterId)!;
    newMaster.isMaster = true;
    newMaster.slotRange = failedMaster.slotRange;

    // Remove the promoted replica from the replicas list
    failedMaster.replicas = failedMaster.replicas.filter(id => id !== newMasterId);
    newMaster.replicas = [...failedMaster.replicas];

    logger.info('Replica promoted to master', {
      failedMaster: failedMasterNodeId,
      newMaster: newMasterId,
      slotRange: newMaster.slotRange
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();
      for (const node of this.nodes.values()) {
        if (node.status === 'connected') {
          node.lastHeartbeat = now;
        } else if (node.status === 'failed') {
          // Check if node should be marked as failed
          const timeSinceLastHeartbeat = now.getTime() - node.lastHeartbeat.getTime();
          if (timeSinceLastHeartbeat > this.clusterConfig.failureDetectionTimeout) {
            logger.warn('Node marked as failed', {
              nodeId: node.nodeId,
              timeSinceLastHeartbeat
            });
          }
        }
      }
    }, this.clusterConfig.heartbeatInterval);
  }

  private startReplication(): void {
    if (this.clusterConfig.replicationMode === 'async') {
      this.replicationTimer = setInterval(async () => {
        // Async replication logic would go here
        // For now, just log that replication is running
        logger.debug('Async replication cycle completed');
      }, 1000);
    }
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      // Reset operations per second counter
      for (const node of this.nodes.values()) {
        node.operationsPerSecond = 0;
      }
    }, 1000);
  }

  private hashFunction(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getMasterNodes(): ClusterNode[] {
    return Array.from(this.nodes.values()).filter(node => node.isMaster);
  }

  private getReplicaNodes(): ClusterNode[] {
    return Array.from(this.nodes.values()).filter(node => !node.isMaster);
  }

  private calculateNodeLoad(node: ClusterNode): number {
    // Simple load calculation based on key count and operations
    return (node.keyCount * 0.7) + (node.operationsPerSecond * 0.3);
  }

  private calculateReplicationHealth(): number {
    const masterNodes = this.getMasterNodes();
    let healthyReplications = 0;
    let totalReplications = 0;

    for (const master of masterNodes) {
      for (const replicaId of master.replicas) {
        totalReplications++;
        const replica = this.nodes.get(replicaId);
        if (replica && replica.status === 'connected') {
          healthyReplications++;
        }
      }
    }

    return totalReplications > 0 ? (healthyReplications / totalReplications) * 100 : 100;
  }

  private hasActiveMasterForSlots(slotRange: { start: number; end: number }): boolean {
    for (const node of this.nodes.values()) {
      if (node.isMaster && node.status === 'connected' && 
          node.slotRange.start === slotRange.start && 
          node.slotRange.end === slotRange.end) {
        return true;
      }
    }
    return false;
  }

  private estimateMemoryUsage(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // Rough estimate for UTF-16
    } else if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    } else {
      return 8; // Rough estimate for primitives
    }
  }

  private logOperation(operation: string, key: string, nodeId: string, latency: number, success: boolean): void {
    this.operationLog.push({
      operation,
      key,
      nodeId,
      timestamp: new Date(),
      latency,
      success
    });

    // Keep only last 1000 operations
    if (this.operationLog.length > 1000) {
      this.operationLog = this.operationLog.slice(-1000);
    }
  }
}

// Export singleton instance
export const redisClusteringService = new RedisClusteringService();
export default redisClusteringService;