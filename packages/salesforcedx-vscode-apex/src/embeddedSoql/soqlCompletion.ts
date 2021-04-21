/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  commands,
  CompletionItem,
  CompletionList,
  EndOfLine,
  Position,
  TextDocument,
  Uri,
  workspace
} from 'vscode';

import { Middleware } from 'vscode-languageclient/lib/main';
import ProtocolCompletionItem from 'vscode-languageclient/lib/protocolCompletionItem';

const virtualDocumentContents = new Map<string, string>();

workspace.registerTextDocumentContentProvider('embedded-soql', {
  provideTextDocumentContent: uri => {
    const originalUri = uri.path.replace(/^\//, '').replace(/.soql$/, '');

    const decodedUri = decodeURIComponent(originalUri);
    return virtualDocumentContents.get(decodedUri);
  }
});

function insideSOQLBlock(
  apexItems: ProtocolCompletionItem[]
): { queryText: string; location: any } | undefined {
  const soqlItem = apexItems.find(i => i.label === '_SOQL_');
  return soqlItem
    ? { queryText: soqlItem.detail as string, location: soqlItem.data }
    : undefined;
}
function insideApexBindingExpression(
  document: TextDocument,
  soqlQuery: string,
  position: Position
): boolean {
  // TODO Implement logic to extract binging expressions not covered by Apex LSP ?
  // i.e.:  :(xyz.toUpperCase() + 'xyz')
  // const rangeAtCursor = document.getWordRangeAtPosition(position, /[:(_\.\w]+/);
  // const wordAtCursor = rangeAtCursor
  //   ? document.getText(rangeAtCursor)
  //   : undefined;
  // return !!wordAtCursor && wordAtCursor.startsWith(':');
  return false;
}

function getSOQLVirtualContent(
  document: TextDocument,
  position: Position,
  soqlBlock: { queryText: string; location: any }
): string {
  const eol = eolForDocument(document);
  let content = document
    .getText()
    .split(eol)
    .map(line => {
      return ' '.repeat(line.length);
    })
    .join(eol);

  content =
    content.slice(0, soqlBlock.location.startIndex) +
    soqlBlock.queryText +
    content.slice(soqlBlock.location.startIndex + soqlBlock.queryText.length);

  return content;
}

export const soqlMiddleware: Middleware = {
  provideCompletionItem: async (document, position, context, token, next) => {
    const apexCompletionItems = await next(document, position, context, token);
    const items: ProtocolCompletionItem[] = Array.isArray(apexCompletionItems)
      ? (apexCompletionItems as ProtocolCompletionItem[])
      : ((apexCompletionItems as CompletionList)
          .items as ProtocolCompletionItem[]);

    const soqlBlock = insideSOQLBlock(items);
    if (
      soqlBlock &&
      !insideApexBindingExpression(document, soqlBlock.queryText, position)
    ) {
      return await doSOQLCompletion(document, position, context, soqlBlock);
    }

    return apexCompletionItems;
  }
};

async function doSOQLCompletion(
  document: TextDocument,
  position: Position,
  context: any,
  soqlBlock: any
): Promise<CompletionItem[] | CompletionList<CompletionItem>> {
  const originalUri = document.uri.toString();
  virtualDocumentContents.set(
    originalUri,
    getSOQLVirtualContent(document, position, soqlBlock)
  );

  const vdocUriString = `embedded-soql://soql/${encodeURIComponent(
    originalUri
  )}.soql`;
  const vdocUri = Uri.parse(vdocUriString);
  const soqlCompletions = await commands.executeCommand<CompletionList>(
    'vscode.executeCompletionItemProvider',
    vdocUri,
    position,
    // new vscode.Position(0, 0),
    context.triggerCharacter
  );
  return soqlCompletions || [];
}

function eolForDocument(doc: TextDocument) {
  switch (doc.eol) {
    case EndOfLine.LF:
      return '\n';
    case EndOfLine.CRLF:
      return '\r\n';
  }
  return '\n';
}
