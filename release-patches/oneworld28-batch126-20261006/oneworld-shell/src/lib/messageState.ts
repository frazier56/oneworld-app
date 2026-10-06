/** Reconcile either arrival order of the send response and realtime echo. */
export function settleOutgoingMessage<T extends { id: string; pending?: boolean }>(
  messages: T[], temporaryId: string, messageId: string,
): T[] {
  if (temporaryId === messageId) {
    return messages.map(message => message.id === messageId ? { ...message, pending: false } : message);
  }
  if (messages.some(message => message.id === messageId)) {
    return messages.filter(message => message.id !== temporaryId);
  }
  return messages.map(message => message.id === temporaryId
    ? { ...message, id: messageId, pending: false }
    : message);
}
