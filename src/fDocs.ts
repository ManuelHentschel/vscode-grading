
// WIP.
// 
// These functions/classes are used to combine multiple exercises etc. into a virtual document.
// Things have got a bit complicated, the basic use case works.
// Linking to the original source or applying grading decos would be nice to have.



import * as vscode from 'vscode';
import { TextWithRange } from './types';

declare class TextSource {
    getFullText(): string;
    getRange(): vscode.Range | undefined;
}

export class TextFromText implements TextSource {
    public text: string;
    constructor(text: string){
        this.text = text;
    }
    getFullText(): string {
        return this.text;
    }
    getRange(): undefined {
        return undefined;
    }
}

export class TextFromDoc implements TextSource {
    public range: vscode.Range;
    public doc: vscode.TextDocument;
    constructor(doc: vscode.TextDocument, range: vscode.Range){
        this.doc = doc;
        this.range = range;
    }
    getFullText(): string {
        return this.doc.getText(this.range);
    }
    getRange(): vscode.Range {
        return this.range;
    }
}


abstract class TextBody {
    abstract getFullText(): string;
    getLines(start?: number, end?: number): string[] {
        const allLines = this.getFullText().split('\n');
        const lines = allLines.slice(start, end);
        return lines;
    }
    getText(range?: vscode.Range): string {
        if(!range){
            return this.getFullText();
        }
        if(range.isEmpty){
            return '';
        }
        const lines = this.getLines(range.start.line, range.end.line + 1);
        lines[lines.length - 1] = lines[lines.length - 1]!.slice(0, range.end.character);
        lines[0] = lines[0]!.slice(range.start.character);
        
        const text = lines.join('\n');
        return text;
    }
    getEndPos(): vscode.Position {
        const lines = this.getLines();
        const line1 = lines[lines.length - 1]!;
        const pos1 = new vscode.Position(lines.length - 1, line1.length);
        return pos1;
    }
    getLocalRange(): vscode.Range | undefined {
        const pos0 = new vscode.Position(0, 0);
        const pos1 = this.getEndPos();
        return new vscode.Range(pos0, pos1);
    }
    get lineCount(): number {
        return this.getLines().length;
    }
    lineAt(line: number): TextWithRange;
    lineAt(position: vscode.Position): TextWithRange;
    lineAt(lineOrPosition: vscode.Position | number): TextWithRange {
        if (typeof lineOrPosition !== 'number') {
            lineOrPosition = lineOrPosition.line;
        }
        const lines = this.getLines();
        if(lineOrPosition >= lines.length){
            throw new Error('Invalid line number!');
        }
        
        const line = lines[lineOrPosition]!;
        const pos0 = new vscode.Position(lineOrPosition, 0);
        const pos1 = new vscode.Position(lineOrPosition, line.length);
        const range = new vscode.Range(pos0, pos1);
        const ret: TextWithRange = {
            text: line,
            range: range,
        };
        return ret;
    }
    validatePosition(position: vscode.Position): vscode.Position {
        if(position.line >= this.lineCount){
            return this.getEndPos();
        }
        const line = this.lineAt(position.line);
        if(position.character > line.text.length){
            return new vscode.Position(position.line, line.text.length);
        }
        return position;
    }
    validateRange(range: vscode.Range): vscode.Range {
        const pos0 = this.validatePosition(range.start);
        const pos1 = this.validatePosition(range.end);
        return new vscode.Range(pos0, pos1);
    }
}



class FPart extends TextBody {
    textSource: TextSource;
    constructor(textSource: TextSource){
        super();
        this.textSource = textSource;
    }
    getFullText(): string {
        return this.textSource.getFullText();
    }

    convertLocalToSourcePosition(localPosition: vscode.Position): vscode.Position | undefined {
        const sourcePos0 = this.textSource.getRange()?.start;
        if(!sourcePos0){
            return undefined;
        }
        if(localPosition.line === 0){
            return sourcePos0.translate(0, localPosition.character);
        }
        return localPosition.translate(sourcePos0.line, 0);
    }
    convertSourceToLocalPosition(position: vscode.Position): vscode.Position | undefined {
        const sourcePos0 = this.textSource.getRange()?.start;
        if(!sourcePos0){
            return undefined;
        }
        if(position.line < sourcePos0.line){
            throw new Error('Invalid position!');
        }
        if(position.line > sourcePos0.line){
            return position.translate(-sourcePos0.line, 0);
        }
        // hence position.line === pos0.line:
        if(position.character < sourcePos0.character){
            throw new Error('Invalid position!');
        }
        return position.translate(0, -sourcePos0.character);
    }
}


export class FDoc extends TextBody {
    parts: FPart[] = [];
    constructor(parts: TextSource[] = []){
        super();
        this.parts = parts.map(part => new FPart(part));
    }
    addPart(part: TextSource){
        this.parts.push(new FPart(part));
    }
    
    getFullText(): string {
        return this.parts.map(part => part.getText()).join('\n');
    }
    convertLocalToSourceFPosition(localPos: vscode.Position): FPosition | undefined {
        const fpos = this.convertLocalToFPosition(localPos);
        const part = this.parts[fpos.part]!;
        const pos2 = part.convertLocalToSourcePosition(fpos);
        if(!pos2){
            return undefined;
        }
        return pos2 && new FPosition(fpos.part, pos2);
    }
    convertLocalToFPosition(pos: vscode.Position): FPosition {
        let line = pos.line;
        let char = pos.character;
        for (let partid = 0; partid < this.parts.length; partid++) {
            const part = this.parts[partid]!;
            if (line < part.lineCount) {
                return new FPosition(partid, line, char);
            }
            line -= part.lineCount;
        }
        throw new Error('Invalid position!');
    }
    convertFToLocalPosition(fpos: FPosition): vscode.Position {
        const part = this.parts[fpos.part];
        if(!part){
            throw new Error('Invalid part.');
        }
        let lineDelta = 0;
        for (const ppart of this.parts.slice(0, fpos.part)) {
            lineDelta += ppart.lineCount;
        }
        return fpos.translate(lineDelta, 0);
    }
    convertSourceFToLocalPosition(fpos: FPosition): vscode.Position {
        const part = this.parts[fpos.part];
        if(!part){
            throw new Error('Invalid part.');
        }
        const localPos = part.convertSourceToLocalPosition(fpos);
        if(!localPos){
            throw new Error('Invalid part (does not have local range).');
        }
        let lineDelta = 0;
        for (const ppart of this.parts.slice(0, fpos.part)) {
            lineDelta += ppart.lineCount;
        }
        return localPos.translate(lineDelta, 0);
    }
}


class FPosition extends vscode.Position {
    readonly part: number;
    constructor(part: number, pos: vscode.Position);
    constructor(part: number, line: number, character: number);
    constructor(part: number, lineOrPos: number | vscode.Position, character?: number) {
        if(typeof lineOrPos === 'number'){
            super(lineOrPos, character!);
        } else {
            super(lineOrPos.line, lineOrPos.character);
        }
        this.part = part;
    }
}

class TRange<T extends vscode.Position> extends vscode.Range {
    readonly start: T;
    readonly end: T;
    constructor(
        start: T,
        end: T
    ) {
        super(start, end);
        this.start = start;
        this.end = end;
    }
}

class FRange extends TRange<FPosition> {};

// class FRange extends vscode.Range {
//     readonly start: FPosition;
//     readonly end: FPosition;
//     constructor(
//         start: FPosition,
//         end: FPosition
//     ) {
//         super(start, end);
//         this.start = start;
//         this.end = end;
//     }
// }


type MaybeFRange<T extends FPosition | vscode.Position> = T extends FPosition ? FRange : vscode.Range;

function convertRange<
    T extends vscode.Position,
    S extends vscode.Position
>(
    rng: TRange<T>,
    convert: (pos: T) => S
): TRange<S> {
    const start = convert(rng.start);
    const end = convert(rng.end);
    return new TRange(start, end);
}
