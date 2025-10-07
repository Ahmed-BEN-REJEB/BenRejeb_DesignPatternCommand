import Stack from './stack';
import Konva from "konva";
import { createMachine, interpret } from "xstate";

const stage = new Konva.Stage({
    container: "container",
    width: 400,
    height: 400,
});

// Une couche pour le dessin
const dessin = new Konva.Layer();
// Une couche pour la polyline en cours de construction
const temporaire = new Konva.Layer();
stage.add(dessin);
stage.add(temporaire);

const MAX_POINTS = 10;
let polyline // La polyline en cours de construction;

// ---------------- Command Pattern (ConcreteCommand + UndoManager) ----------------
class Command {
    execute() {}
    undo() {}
}

class AddLineCommand extends Command {
    constructor(line, layer) {
        super();
        this.line = line;
        this.layer = layer;
    }
    execute() {
        // add the line to its layer and redraw
        this.layer.add(this.line);
        if (this.layer.batchDraw) this.layer.batchDraw();
    }
    undo() {
        // remove the line from the layer and redraw
        this.line.remove();
        if (this.layer.batchDraw) this.layer.batchDraw();
    }
}

class UndoManager {
    constructor() {
        this.undoStack = new Stack();
        this.redoStack = new Stack();
    }

    executeCommand(command) {
        command.execute();
        this.undoStack.push(command);
        // clear redo stack when new command executed
        this.redoStack = new Stack();
    }

    undo() {
        if (this.undoStack.isEmpty()) return;
        const cmd = this.undoStack.pop();
        cmd.undo();
        this.redoStack.push(cmd);
    }

    redo() {
        if (this.redoStack.isEmpty()) return;
        const cmd = this.redoStack.pop();
        cmd.execute();
        this.undoStack.push(cmd);
    }
}

const undoManager = new UndoManager();

const polylineMachine = createMachine(
    {
        /** @xstate-layout N4IgpgJg5mDOIC5QAcD2AbAngGQJYDswA6XCdMAYgFkB5AVQGUBRAYWwEkWBpAbQAYAuohSpYuAC65U+YSAAeiAIwAWAGxEArAGYAHDo0AmA3x2qNqxRoA0ITEoCciosoDsRg-Zf6DWg4pcAvgE2aFh4hETSYAAKqATi1PTMbJy8grJoYpLSsgoIFvZEOpbKij5l9jou9jZ2CIqOzm4+Ospa1YZ8qkEhGDgExFGx8YmMTLQAakz8QkggmRJSMnN5rlpE9ho69j5aWpVtLta2SnxOBjpaDRcWygZqOj3zfeGDhMP4CUywAMYAhsgwDMMqJFjkVkpVAZnNt2mV9tVfFpaohfHwigYNG0NOZVEcdAYnqF+hEALZ-fCYD7iWCjZIcbjAuYLbLLUB5RR8FzrcxaZR8YwXFyuFEIAxeIgubmqPH2eyuExtIkvAZEcmU6m02hjFKMxSzERZJa5U6qHSadp85RYy6KKqirR45xaPhdUqKO1mZTKsKq9VUuKfLVJcY0KZMw1gtnyJRlDREGVQtyGLHWlyiznnW07Uwqe6BYLPX1kikB+K077-QER55G8HsxA6AWaLmeHFVLFQh2FKoGKHy-ZaDRlAu9YvEf2aihMT5gABONZZxohCB2PalRiHpj5JlFAFpOc4PUd2splJcXDLHoXia81aWpwAhP4-ADWsGQL6B6WZoNZJoQFxFHUNp2kuGVrTxZQHWMDEsSHXF8UJG8VRLDVAxpChnzfD8vx4fUQTraNVlUZQikqTo7XsLlqhg9ECXgnEZXxRQtCCQt8FQCA4BBcdCKjAC9zUI9pVUAUvDRZETgQPdPHIvhHC8M12guZCxxJYhSHIfj-xXJwtj7PZPD8WUzR0UU-DIzFTE8UoqmAvkfQ0yJ3gwnTlwbBBTyIfZzz4DRqIJPgrgslQiGs1RbLtIDVEclDx3vdDy3c+sY1XS5JQ0BT2li6zzOkyyE0RD1gv2Kp5XYgIgA */
        id: "polyLine",
        initial: "idle",
        states: {
            idle: {
                on: {
                    MOUSECLICK: {
                        target: "onePoint",
                        actions: "createLine",
                    },
                },
            },
            onePoint: {
                on: {
                    MOUSECLICK: {
                        target: "manyPoints",
                        actions: "addPoint",
                    },
                    MOUSEMOVE: {
                        actions: "setLastPoint",
                    },
                    Escape: { // event.key
                        target: "idle",
                        actions: "abandon",
                    },
                },
            },
            manyPoints: {
                on: {
                    MOUSECLICK: [
                        {
                            actions: "addPoint",
                            cond: "pasPlein",
                        },
                        {
                            target: "idle",
                            actions: ["addPoint", "saveLine"],
                        },
                    ],

                    MOUSEMOVE: {
                        actions: "setLastPoint",
                    },

                    Escape: {
                        target: "idle",
                        actions: "abandon",
                    },

                    Enter: { // event.key
                        target: "idle",
                        actions: "saveLine",
                    },

                    Backspace: [ // event.key
                        {
                            target: "manyPoints",
                            actions: "removeLastPoint",
                            cond: "plusDeDeuxPoints",
                            internal: true,
                        },
                        {
                            target: "onePoint",
                            actions: "removeLastPoint",
                        },
                    ],
                },
            },
        },
    },
    {
        actions: {
            createLine: (context, event) => {
                const pos = stage.getPointerPosition();
                polyline = new Konva.Line({
                    points: [pos.x, pos.y, pos.x, pos.y],
                    stroke: "red",
                    strokeWidth: 2,
                });
                temporaire.add(polyline);
            },
            setLastPoint: (context, event) => {
                const pos = stage.getPointerPosition();
                const currentPoints = polyline.points(); // Get the current points of the line
                const size = currentPoints.length;

                const newPoints = currentPoints.slice(0, size - 2); // Remove the last point
                polyline.points(newPoints.concat([pos.x, pos.y]));
                temporaire.batchDraw();
            },
            saveLine: (context, event) => {
                polyline.remove(); // On l'enlève de la couche temporaire
                const currentPoints = polyline.points(); // Get the current points of the line
                const size = currentPoints.length;
                // Le dernier point(provisoire) ne fait pas partie de la polyline
                const newPoints = currentPoints.slice(0, size - 2);
                polyline.points(newPoints);
                polyline.stroke("black"); // On change la couleur
                // On sauvegarde la polyline dans la couche de dessin
                // Use Command pattern to add the line so it can be undone/redone
                const cmd = new AddLineCommand(polyline, dessin);
                undoManager.executeCommand(cmd);
                // clear the reference to current polyline (a new one will be created on next createLine)
                polyline = undefined;
            },
            addPoint: (context, event) => {
                const pos = stage.getPointerPosition();
                const currentPoints = polyline.points(); // Get the current points of the line
                const newPoints = [...currentPoints, pos.x, pos.y]; // Add the new point to the array
                polyline.points(newPoints); // Set the updated points to the line
                temporaire.batchDraw(); // Redraw the layer to reflect the changes
            },
            abandon: (context, event) => {
                polyline.remove();
            },
            removeLastPoint: (context, event) => {
                const currentPoints = polyline.points(); // Get the current points of the line
                const size = currentPoints.length;
                const provisoire = currentPoints.slice(size - 2, size); // Le point provisoire
                const oldPoints = currentPoints.slice(0, size - 4); // On enlève le dernier point enregistré
                polyline.points(oldPoints.concat(provisoire)); // Set the updated points to the line
                temporaire.batchDraw(); // Redraw the layer to reflect the changes
            },
        },
        guards: {
            pasPlein: (context, event) => {
                // On peut encore ajouter un point
                return polyline.points().length < MAX_POINTS * 2;
            },
            plusDeDeuxPoints: (context, event) => {
                // Deux coordonnées pour chaque point, plus le point provisoire
                return polyline.points().length > 6;
            },
        },
    }
);

const polylineService = interpret(polylineMachine)
    .onTransition((state) => {
        console.log("Current state:", state.value);
    })
    .start();

stage.on("click", () => {
    polylineService.send("MOUSECLICK");
});

stage.on("mousemove", () => {
    polylineService.send("MOUSEMOVE");
});

window.addEventListener("keydown", (event) => {
    console.log("Key pressed:", event.key);
    polylineService.send(event.key);
});

// bouton Undo
const undoButton = document.getElementById("undo");
undoButton.addEventListener("click", () => {
    undoManager.undo();
});
// bouton Redo
const redoButton = document.getElementById("redo");
if (redoButton) {
    redoButton.addEventListener("click", () => {
        undoManager.redo();
    });
}

class ChangeColorCommand extends Command {
    constructor(line, newColor) {
        super();
        this.line = line;
        this.newColor = newColor;
        this.oldColor = line ? line.stroke() : null;
    }
    execute() {
        if (!this.line) return;
        this.line.stroke(this.newColor);
        console.log('ChangeColorCommand.execute:', this.newColor, 'for', this.line);
        const layer = this.line.getLayer();
        if (layer && layer.batchDraw) layer.batchDraw();
    }
    undo() {
        if (!this.line) return;
        this.line.stroke(this.oldColor);
        console.log('ChangeColorCommand.undo: restore', this.oldColor, 'for', this.line);
        const layer = this.line.getLayer();
        if (layer && layer.batchDraw) layer.batchDraw();
    }
}

// Track the selected polyline (last clicked in the dessin layer)
let selectedLine = null;

// Click handler on dessin layer to select a polyline
dessin.on('click', (evt) => {
    // If the shape is a Konva.Line
    const shape = evt.target;
    if (shape && shape.getClassName && shape.getClassName() === 'Line') {
        selectedLine = shape;
        // simple visual feedback: change strokeWidth briefly or set dash
        // reset other lines' shadow/width
        dessin.find('Line').forEach(l => l.strokeWidth(2));
        selectedLine.strokeWidth(4);
        dessin.batchDraw();
        updateButtons();
    }
});

// Color buttons
// Create color buttons dynamically (so no HTML change required)
const parentContainer = document.getElementById('container');
let colorRedBtn = null;
let colorBlueBtn = null;
if (parentContainer) {
    // create a small control panel below the canvas
    const ctrl = document.createElement('div');
    ctrl.style.marginTop = '8px';
    colorRedBtn = document.createElement('button');
    colorRedBtn.id = 'colorRed';
    colorRedBtn.textContent = 'Couleur: Rouge';
    colorBlueBtn = document.createElement('button');
    colorBlueBtn.id = 'colorBlue';
    colorBlueBtn.textContent = 'Couleur: Bleu';
    ctrl.appendChild(colorRedBtn);
    ctrl.appendChild(colorBlueBtn);
    parentContainer.parentNode.insertBefore(ctrl, parentContainer.nextSibling);
}

function updateButtons() {
    // enable/disable undo redo according to stacks
    if (undoButton) undoButton.disabled = !undoManager.canUndo();
    if (redoButton) redoButton.disabled = !undoManager.canRedo();
    // color buttons enabled only if a line is selected
    if (colorRedBtn) colorRedBtn.disabled = !selectedLine;
    if (colorBlueBtn) colorBlueBtn.disabled = !selectedLine;
}

if (colorRedBtn) {
    colorRedBtn.addEventListener('click', () => {
        if (!selectedLine) return;
        const cmd = new ChangeColorCommand(selectedLine, 'red');
        undoManager.executeCommand(cmd);
        updateButtons();
    });
}

if (colorBlueBtn) {
    colorBlueBtn.addEventListener('click', () => {
        if (!selectedLine) return;
        const cmd = new ChangeColorCommand(selectedLine, 'blue');
        undoManager.executeCommand(cmd);
        updateButtons();
    });
}

// initialize button states
updateButtons();
