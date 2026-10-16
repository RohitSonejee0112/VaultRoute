export interface MessageEnvelope<T = unknown> {
  id: string;
  topic: string;
  timestamp: string;
  payload: T;
}

export type MessageHandler<T = unknown> = (message: MessageEnvelope<T>) => Promise<void> | void;

/**
 * Abstract Message Broker Interface.
 * Decouples in-process event dispatching from distributed streaming brokers (Redis Streams, RabbitMQ, BullMQ).
 */
export interface IMessageBroker {
  publish<T>(topic: string, payload: T): Promise<string>;
  subscribe<T>(topic: string, handler: MessageHandler<T>): () => void;
  getTopicHistory(topic: string): MessageEnvelope[];
}
