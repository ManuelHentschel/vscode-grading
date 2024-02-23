
export interface VsCode {
    postMessage: (msg: OutMessage) => void;
    setState: (state: string) => void;
}


export interface IOutMessage {
    message: string;
}
export interface LogMessage extends IOutMessage {
    message: 'log',
    body: any
}
export interface CellClickMessage extends IOutMessage {
    message: 'mouseClick',
    button: number,
    buttons: number,
    ctrlKey: boolean,
    cellId: string
}

export type OutMessage = LogMessage | CellClickMessage

