
import { VsCode } from './webviewMessages';

declare function acquireVsCodeApi(): VsCode;

const vscode = acquireVsCodeApi();


// on window load, add onClick events to all table cells:
window.onload = function () {
    // console.log('doing onload');
    // vscode.postMessage({
    //     message: 'log',
    //     body: 'onload'
    // });

    // get the table
    const table = document.getElementById('table');
    const cells = table?.getElementsByTagName("td");
    if(!cells){
        console.log('No table found!');
        return;
    }
    
    // loop through all the cells in the table
    for (let i = 0; i < cells.length; i++) {
        // get current cell
        const cell = cells[i];
        // add onclick event to the cell
        cell.onclick = (ev) => {
            vscode.postMessage({
                message: 'mouseClick',
                button: ev.button,
                buttons: ev.buttons,
                ctrlKey: ev.ctrlKey,
                cellId: cell.id
            });
        };
    }
    // console.log('done onload');
};
