import { pointsToString } from "./webview";



export class HTMLElement {
    tag: string;
    content: (string | HTMLElement)[] = [];
    attributes: Record<string, string> = {};
    classes: string[] = [];
    
    constructor(tag: string, content?: (string | HTMLElement)[], attributes?: Record<string, string>){
        this.tag = tag;
        if(content){
            this.content = content;
        }
        if(attributes){
            this.attributes = attributes;
        }
    }
    
    get id(): string | undefined {
        return this.attributes?.id;
    }
    
    set id(id: string | undefined) {
        this.attributes ||= {};
        if(id) {
            this.attributes.id = id;
        } else {
            delete this.attributes.id;
        }
    }
    
    toString(): string {
        const leftTagParts = [this.tag];
        const attributes = {...this.attributes};
        if(this.classes.length){
            attributes.class = this.classes.join(' ');
        }
        for (const [key, value] of Object.entries(attributes)) {
            leftTagParts.push(`${key}="${value}"`);
        }
        const isEmpty = !this.content.length;
        const rightTag = isEmpty ? '' : `</${this.tag}>`;
        if(isEmpty){
            leftTagParts.push('/');
        }
        const leftTag = `<${leftTagParts.join(' ')}>`;
        const strContent = this.content.map(c => typeof c === 'string' ? c : c.toString()).join('\n');
        return leftTag + strContent + rightTag;
    }
}

export class HTMLCell extends HTMLElement {
    constructor(isHeader: boolean = false){
        super(isHeader ? 'th' : 'td');
        this.classes.push('cell');
    }
}

export class HTMLYesNoCell extends HTMLCell {
    constructor(yes: boolean){
        super();
        this.classes.push('yesNoCell');
        this.classes.push(yes ? 'yes' : 'no');
        this.content.push(yes ? '1' : '0');
    }
}

export class HTMLPointsCell extends HTMLCell {
    constructor(points: number, totalPoints?: number){
        super();
        this.classes.push('pointsCell');
        this.content.push(pointsToString(points));
        if(totalPoints !== undefined){
            if(points === totalPoints){
                this.classes.push('fullPoints');
            } else if(points === 0){
                this.classes.push('zeroPoints');
            } else {
                this.classes.push('partialPoints');
            }
        }
    }
}

export class HTMLRow extends HTMLElement {
    constructor(cells?: HTMLCell[]){
        super('tr', cells);
        this.classes.push('row');
    }
}

export class HTMLTable extends HTMLElement {
    constructor(rows?: HTMLRow[]){
        super('table', rows);
        this.classes.push('table');
    }
}
