import { randomUUID } from 'crypto';
import { IMessageBroker, MessageEnvelope, MessageHandler } from './messageBroker';

export class InMemoryMessageBroker implements IMessageBroker {
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private history: Map<string, MessageEnvelope[]> = new Map();

  async publish<T>(topic: string, payload: T): Promise<string> {
    const envelope: MessageEnvelope<T> = {
      id: randomUUID(),
      topic,
      timestamp: new Date().toISOString(),
      payload
    };

    if (!this.history.has(topic)) {
      this.history.set(topic, []);
    }
    this.history.get(topic)!.push(envelope as MessageEnvelope);

    const topicHandlers = this.handlers.get(topic);
    if (topicHandlers) {
      for (const handler of topicHandlers) {
        try {
          await handler(envelope as MessageEnvelope);
        } catch (err) {
          console.error(`[Broker Error] Handler threw for topic "${topic}":`, err);
        }
      }
    }

    return envelope.id;
  }

  subscribe<T>(topic: string, handler: MessageHandler<T>): () => void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
    }
    const topicSet = this.handlers.get(topic)!;
    topicSet.add(handler as MessageHandler);

    return () => {
      topicSet.delete(handler as MessageHandler);
    };
  }

  getTopicHistory(topic: string): MessageEnvelope[] {
    return this.history.get(topic) || [];
  }
}
