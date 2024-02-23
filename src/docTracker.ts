
import * as vscode from 'vscode';
import * as path from 'path';
import * as types from './types';
import { getConfig } from './readConfig';
import { parseAndMatchDoc } from './parseDocument';
import { BackgroundDecos, DecoManager, DecoWithRanges } from './deco';
import { assertMinArrayLength, computeHashForDoc, getUniqueEntries } from './utils';
import { statSync } from 'fs';
import { refreshWebviews } from './webview';

export const SOLUTION_ID = '\\/SOLUTION\\/';

interface TrackedDoc {
    doc: vscode.TextDocument;
    hash: string;
    matchedDoc: types.MatchedDocument;
    decos?: DecoWithRanges[];
}

let docTracker: DocTracker | undefined = undefined;

export function getDocTracker(): DocTracker {
    docTracker ||= new DocTracker();
    return docTracker;
}

export class DocTracker {
    docMap: Map<vscode.TextDocument, TrackedDoc> = new Map();
    dispos: vscode.Disposable[] = [];
    decoManager: DecoManager;
    
    changeTextDocumentTimeOut: NodeJS.Timeout | undefined = undefined;
    changeTextDocumentDoc: vscode.TextDocument | undefined = undefined;
    typeDelay: number;

    constructor() {
        this.decoManager = new DecoManager();
        this.dispos.push(vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
            this.handleChangeTextDocument(e);
        }));
        this.dispos.push(vscode.window.onDidChangeVisibleTextEditors((editors) => this.handleEditors(editors)));
        this.dispos.push(vscode.workspace.onDidChangeConfiguration(e => {
            if(e.affectsConfiguration('grading')){
                console.log('Config changed');
                this.disposeDocMap();
                this.handleEditors(vscode.window.visibleTextEditors);
                this.typeDelay = getConfig().get('typeDelay', 1000);
            }
        }));
        this.typeDelay = getConfig().get('typeDelay', 1000);
        this.handleEditors(vscode.window.visibleTextEditors);
    }

    disposeDocMap(): void {
        this.docMap.forEach((v, k) => {
            v.decos?.forEach(deco => {
                deco.deco.dispose();
            });
        });
        this.docMap = new Map();
    }
    dispose(): void {
        this.disposeDocMap();
        this.dispos.forEach(dispo => dispo.dispose());
        this.dispos = [];
    }
    
    handleChangeTextDocument(e?: vscode.TextDocumentChangeEvent): void {
        // Clear previous timeout
        clearTimeout(this.changeTextDocumentTimeOut);
        
        // If empty event, handle doc and return
        if(!e){
            this.handleDoc(this.changeTextDocumentDoc);
            return;
        }
        
        // Handle previous doc if different
        if(this.changeTextDocumentDoc && this.changeTextDocumentDoc !== e.document){
            this.handleDoc(this.changeTextDocumentDoc);
        }

        // Set new timeout for current doc
        this.changeTextDocumentDoc = e.document;
        this.changeTextDocumentTimeOut = setTimeout(() => {
            this.handleDoc(this.changeTextDocumentDoc);
            this.changeTextDocumentDoc = undefined;
            refreshWebviews();
        }, this.typeDelay);
    }
    
    handleEditors(editors: readonly vscode.TextEditor[]): (TrackedDoc | undefined)[] {
        const docs = getUniqueEntries(editors.map(editor => editor.document));
        const tds = docs.map(doc => this.handleDoc(doc));
        void refreshWebviews();
        return tds;
    }
    handleEditor(editor: vscode.TextEditor): TrackedDoc | undefined {
        return this.handleDoc(editor.document);
    }
    
    public getMatchedDoc(doc: vscode.TextDocument, refresh = true): types.MatchedDocument | undefined {
        if(refresh){
            this.handleChangeTextDocument();
        }
        return this.docMap.get(doc)?.matchedDoc;
    }
    
    public handleDoc(doc?: vscode.TextDocument): TrackedDoc | undefined {
        if(!doc){
            return;
        }
        const id = verifyDocument(doc);
        if(!id){
            return;
        }
        let td = this.docMap.get(doc);
        if(!td){
            td = this.addTrackedDoc(doc, id);
        } else{
            const oldHash = td.hash;
            td.hash = computeHashForDoc(doc);
            if(td.hash !== oldHash){
                this.reparseDoc(td, id);
            }
        }
        for(const editor of getVisibleEditors(td.doc)){
            this.decoManager.applyDecos(editor, td.decos || []);
        }
        return td;
    }
    
    public getTDocForId(id: string): TrackedDoc[] {
        this.handleChangeTextDocument();
        const ret: TrackedDoc[] = [];
        for(const [doc, td] of this.docMap.entries()){
            if(td.matchedDoc.id === id){
                ret.push(td);
            }
        }
        return ret;
    }
    
    reparseDoc(td: TrackedDoc, id: string){
        const mdoc = parseAndMatchDoc(td.doc, id);
        td.matchedDoc = mdoc;
        const newDecos = this.decoManager.computeDecos(mdoc);
        if(td.decos){
            this.decoManager.clearDecos(td.decos);
        }
        td.decos = newDecos;
    }
    
    addTrackedDoc(doc: vscode.TextDocument, id: string): TrackedDoc {
        const hash = computeHashForDoc(doc);
        const mdoc = parseAndMatchDoc(doc, id);
        const decos = this.decoManager.computeDecos(mdoc);
        const newTd: TrackedDoc = {
            doc: doc,
            matchedDoc: mdoc,
            decos: decos,
            hash: hash
        };
        this.docMap.set(doc, newTd);
        return newTd;
    }
}

export function getVisibleEditors(doc: vscode.TextDocument): vscode.TextEditor[] {
    return vscode.window.visibleTextEditors.filter(editor => {
        return editor.document === doc;
    });
}


export function isSolutionUri(uri: vscode.Uri): boolean {
    const localPath = path.normalize(vscode.workspace.asRelativePath(uri));
    const config = getConfig();
    const solutionFileNames = config.get<string[]>('examFiles.solutionFiles', []);
    for(const fn of solutionFileNames){
        if(path.normalize(fn) === localPath){
            return true;
        }
    }
    return false;
}

export function getVerifiedActiveEditor(): vscode.TextEditor | undefined {
    const editor = vscode.window.activeTextEditor;
    if(!editor){
        return undefined;
    }
    const id = verifyDocument(editor.document);
    if(!id){
        return undefined;
    }
    return editor;
}

export function verifyDocument(doc: vscode.TextDocument | undefined): string | undefined {
    return verifyUri(doc?.uri);
}

export function verifyUri(uri: vscode.Uri | undefined): string | undefined {
    if(!uri){
        console.log('No uri');
        return(undefined);
    }
    if(isSolutionUri(uri)){
        return SOLUTION_ID;
    }
    const config = getConfig();
    const pattern = config.get('examFiles.pattern', '(.*)');
    const re = new RegExp(pattern);
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const absPath = uri.fsPath;
    if(!rootPath || !absPath){
        // console.log('Not both root and abs path');
        return undefined;
    }
    const localPath = path.relative(rootPath, absPath);
    if(uri.scheme !== 'file'){
        // console.log(`Not a file uri: ${localPath}`);
        return undefined;
    }
    if(statSync(absPath).isDirectory()){
        // console.log(`Dir (not file): ${localPath}`);
        return undefined;
    }
    const m = re.exec(localPath);
    if(!m){
        // console.log(`Local path does not match: ${localPath}`);
        return undefined;
    }
    // Second entry (first capture group) contains student ID
    const m2 = assertMinArrayLength(m, 2, 'Exam file pattern must have one capture group.');
    return m2[1];
}




