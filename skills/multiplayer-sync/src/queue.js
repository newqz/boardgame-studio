/**
 * Message Queue
 * Priority-based message queue with batching
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * Message priority levels
 */
const MessagePriority = Object.freeze({
  CRITICAL: 0,   // Game end, reconnect state
  HIGH: 1,       // Input confirmations
  NORMAL: 2,     // Regular state updates
  LOW: 3         // Chat, emotes
});

/**
 * @typedef {Object} QueuedMessage
 * @property {string} id - Unique message ID
 * @property {Object} data - Message payload
 * @property {number} priority - Priority level
 * @property {number} timestamp - When message was queued
 * @property {number} attempts - Delivery attempts
 */

/**
 * @typedef {Object} QueueConfig
 * @property {number} maxQueueSize - Maximum messages per priority queue
 * @property {number} batchSize - Messages per batch send
 * @property {number} flushInterval - Ms between batch flushes
 * @property {number} maxRetries - Maximum delivery attempts
 */

const DEFAULT_CONFIG = Object.freeze({
  maxQueueSize: 1000,
  batchSize: 50,
  flushInterval: 100,
  maxRetries: 3
});

class MessageQueue {
  /**
   * Create a new Message Queue
   * @param {Object} [config={}] - Configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {Map<number, QueuedMessage[]>} */
    this.queues = new Map();

    // Initialize queues for each priority
    for (let i = 0; i <= MessagePriority.LOW; i++) {
      this.queues.set(i, []);
    }

    /** @type {Function|null} */
    this.sendCallback = null;

    /** @type {NodeJS.Timeout|null} */
    this.flushTimer = null;

    /** @type {boolean} */
    this.isProcessing = false;

    /** @type {Map<string, number>} */
    this.messageCounts = new Map();

    /** @type {number} */
    this.messageIdCounter = 0;
  }

  /**
   * Set the send callback for delivering messages
   * @param {Function} callback - Function to send messages
   */
  setSendCallback(callback) {
    this.sendCallback = callback;
  }

  /**
   * Start automatic flushing
   */
  start() {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop automatic flushing
   */
  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Enqueue a message
   * @param {Object} data - Message payload
   * @param {number} [priority=MessagePriority.NORMAL] - Priority level
   * @returns {string} Message ID
   */
  enqueue(data, priority = MessagePriority.NORMAL) {
    const messageId = `msg_${++this.messageIdCounter}_${Date.now()}`;

    const message = {
      id: messageId,
      data,
      priority: Math.max(MessagePriority.CRITICAL, Math.min(MessagePriority.LOW, priority)),
      timestamp: Date.now(),
      attempts: 0
    };

    const queue = this.queues.get(message.priority);
    queue.push(message);

    // Check queue size limit
    if (queue.length > this.config.maxQueueSize) {
      // Remove oldest low priority message
      const removed = queue.shift();
      this._onMessageDropped(removed);
    }

    this.messageCounts.set(message.priority,
      (this.messageCounts.get(message.priority) || 0) + 1);

    return messageId;
  }

  /**
   * Enqueue a critical message (bypasses queue limits)
   * @param {Object} data - Message payload
   * @returns {string} Message ID
   */
  enqueueCritical(data) {
    return this.enqueue(data, MessagePriority.CRITICAL);
  }

  /**
   * Enqueue a high priority message
   * @param {Object} data - Message payload
   * @returns {string} Message ID
   */
  enqueueHigh(data) {
    return this.enqueue(data, MessagePriority.HIGH);
  }

  /**
   * Enqueue a low priority message (chat, etc)
   * @param {Object} data - Message payload
   * @returns {string} Message ID
   */
  enqueueLow(data) {
    return this.enqueue(data, MessagePriority.LOW);
  }

  /**
   * Flush all queues (send messages)
   * @returns {number} Number of messages flushed
   */
  flush() {
    if (this.isProcessing || !this.sendCallback) {
      return 0;
    }

    this.isProcessing = true;
    let totalFlushed = 0;

    try {
      // Process from highest to lowest priority
      for (let priority = MessagePriority.CRITICAL; priority <= MessagePriority.LOW; priority++) {
        const queue = this.queues.get(priority);
        const batchSize = this._getBatchSize(priority);

        // Take a batch from this priority
        const batch = [];
        while (batch.length < batchSize && queue.length > 0) {
          const message = queue.shift();
          if (this._shouldRetry(message)) {
            batch.push(message);
          } else {
            this._onMessageDropped(message);
          }
        }

        // Send batch
        if (batch.length > 0) {
          for (const message of batch) {
            try {
              this.sendCallback(message.data);
              message.attempts++;
              totalFlushed++;
            } catch (err) {
              // Re-queue if not max retries
              if (message.attempts < this.config.maxRetries) {
                queue.unshift(message);
              } else {
                this._onMessageFailed(message, err);
              }
            }
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return totalFlushed;
  }

  /**
   * Flush a specific priority queue
   * @param {number} priority - Priority level
   * @returns {number} Messages flushed
   */
  flushPriority(priority) {
    if (!this.sendCallback || this.isProcessing) {
      return 0;
    }

    const queue = this.queues.get(priority);
    let flushed = 0;

    while (queue.length > 0) {
      const message = queue.shift();

      try {
        this.sendCallback(message.data);
        message.attempts++;
        flushed++;
      } catch (err) {
        if (message.attempts < this.config.maxRetries) {
          queue.unshift(message);
        } else {
          this._onMessageFailed(message, err);
        }
        break; // Stop on error
      }
    }

    return flushed;
  }

  /**
   * Get batch size based on priority
   * @param {number} priority - Priority level
   * @returns {number}
   * @private
   */
  _getBatchSize(priority) {
    switch (priority) {
      case MessagePriority.CRITICAL:
        return 10; // Send more critical messages
      case MessagePriority.HIGH:
        return 10;
      case MessagePriority.NORMAL:
        return this.config.batchSize;
      case MessagePriority.LOW:
        return Math.floor(this.config.batchSize / 2);
      default:
        return this.config.batchSize;
    }
  }

  /**
   * Check if message should be retried
   * @param {QueuedMessage} message - Message to check
   * @returns {boolean}
   * @private
   */
  _shouldRetry(message) {
    return message.attempts < this.config.maxRetries;
  }

  /**
   * Get queue status
   * @returns {Object} Queue statistics
   */
  getStatus() {
    const status = {
      total: 0,
      byPriority: {},
      isProcessing: this.isProcessing,
      isRunning: this.flushTimer !== null
    };

    for (const [priority, queue] of this.queues) {
      const priorityName = Object.keys(MessagePriority).find(
        key => MessagePriority[key] === priority
      ) || `P${priority}`;

      status.byPriority[priorityName] = {
        count: queue.length,
        totalSent: this.messageCounts.get(priority) || 0
      };
      status.total += queue.length;
    }

    return status;
  }

  /**
   * Get number of messages in queue
   * @param {number} [priority] - Specific priority (omit for total)
   * @returns {number}
   */
  size(priority) {
    if (priority !== undefined) {
      return this.queues.get(priority)?.length || 0;
    }

    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Check if queue is empty
   * @returns {boolean}
   */
  isEmpty() {
    for (const queue of this.queues.values()) {
      if (queue.length > 0) return false;
    }
    return true;
  }

  /**
   * Clear a specific priority queue
   * @param {number} [priority] - Priority to clear (omit for all)
   */
  clear(priority) {
    if (priority !== undefined) {
      this.queues.get(priority)?.splice(0);
    } else {
      for (const queue of this.queues.values()) {
        queue.splice(0);
      }
    }
  }

  /**
   * Remove a specific message by ID
   * @param {string} messageId - Message ID to remove
   * @returns {boolean} Whether message was found and removed
   */
  remove(messageId) {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(m => m.id === messageId);
      if (index !== -1) {
        queue.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Event: message dropped (queue full or max retries)
   * @param {QueuedMessage} message - Dropped message
   * @private
   */
  _onMessageDropped(message) {
    // Override in subclass or set callback
    // console.warn(`Message dropped: ${message.id}`);
  }

  /**
   * Event: message delivery failed
   * @param {QueuedMessage} message - Failed message
   * @param {Error} error - Error that occurred
   * @private
   */
  _onMessageFailed(message, error) {
    // Override in subclass or set callback
    // console.error(`Message failed: ${message.id}`, error);
  }

  /**
   * Set event handlers
   * @param {Object} handlers - Event handlers
   */
  setHandlers(handlers) {
    if (handlers.onDropped) {
      this._onMessageDropped = handlers.onDropped;
    }
    if (handlers.onFailed) {
      this._onMessageFailed = handlers.onFailed;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stop();
    this.clear();
    this.sendCallback = null;
  }
}

module.exports = {
  MessageQueue,
  MessagePriority,
  DEFAULT_CONFIG
};
