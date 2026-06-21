import { BaseLanguageClient } from 'vscode-languageclient/browser'
import type { LanguageClientOptions, MessageTransports } from 'vscode-languageclient/browser'

export interface MonacoLanguageClientOptions {
  name: string
  id?: string
  clientOptions: LanguageClientOptions
  messageTransports: MessageTransports
}

// Minimal monaco binding for vscode-languageclient's BaseLanguageClient: it is
// abstract only in that it needs message transports supplied. We hold a
// pre-built reader/writer pair (over the editor MessagePort) and hand them back.
export class MonacoLanguageClient extends BaseLanguageClient {
  protected readonly messageTransports: MessageTransports

  constructor({ id, name, clientOptions, messageTransports }: MonacoLanguageClientOptions) {
    super(id ?? name.toLowerCase(), name, clientOptions)
    this.messageTransports = messageTransports
  }

  protected override createMessageTransports(_encoding: string): Promise<MessageTransports> {
    return Promise.resolve(this.messageTransports)
  }
}
