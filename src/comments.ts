
import * as vscode from 'vscode';
import { getConfig } from './readConfig';
import { getVerifiedActiveEditor, verifyDocument } from './docTracker';
import { assertMinArrayLength } from './utils';


export async function appendComment(): Promise<boolean> {
    const editor = getVerifiedActiveEditor();
    if(!editor){
        return false;
    }
    const line = editor.document.lineAt(editor.selection.end);
    const lineEnd = line.range.end;
    const config = getConfig();
    const template = config.get('comment.template', '???');
    const parts = template.split('%content%');
    if(parts.length !== 2){
        throw new Error('Invalid template for comment: ' + template);
    }
    const leadingSpace = line.text.endsWith(' ') ? '' : ' ';
    const snippet = new vscode.SnippetString(leadingSpace + parts[0] + '$1' + parts[1]);
    return editor.insertSnippet(snippet, lineEnd);
}


export async function changeLine(): Promise<boolean> {
    const editor = getVerifiedActiveEditor();
    if(!editor){
        return false;
    }
    const line = editor.document.lineAt(editor.selection.end);
    const lineEnd = line.range.end;
    const config = getConfig();
    const template = config.get('comment.template', '???');
    const parts = assertMinArrayLength(
        template.split('%content%'),
        2,
        'Invalid template for comment: ' + template
    );
    const snippet = new vscode.SnippetString();
    // Append original line as comment
    snippet.appendText(parts[0]);
    snippet.appendText(line.text);
    snippet.appendText(parts[1]);
    snippet.appendText('\n');
    
    // Append original line, followed by comment
    snippet.appendText(line.text);
    if(!line.text.endsWith(' ')){
        snippet.appendText(' ');
    }
    snippet.appendText(parts[0]);
    snippet.appendPlaceholder('COMMENT', 1);
    snippet.appendText(parts[1]);
    return editor.insertSnippet(snippet, line.range);
}
