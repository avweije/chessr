import { focusBoard } from "focus-board";

/**
 * Controller for focus boards.
 * Can be used for all positions or the positions that are grouped together.
 * 
 * Handles rendering, connecting, disconnecting.
 * 
 * Option to run group in practice.
 * 
 * Callbacks:
 * - onConnect    : manager: connects 2 boards, moves them between groups, adds/removes group
 * - onDisconnect : manager, see above
 * - 
 * 
 * Functions:
 * - run in practice
 * -
 */
export class focusBoardGroup {
    parent = null;
    isMainGroup = false;
    focused = null;
    boardSettings = null;

    elements = {
        container: null,
        header: null,
        groupHeader: null,
        boardContainer: null,
        practiceButton: null,
        zoomOutButton: null,
        zoomInButton: null
    };

    // Used for zoom in/out, set initial size to same as in CSS
    boardSize = {
        current: 350,
        min: 200,
        max: 500,
        step: 50
    };

    // The FocusBoards collection
    boards = [];

    constructor(parent, isMainGroup, focused, boardSettings) {

        console.log('focusBoardGroup constructor', focused);

        this.parent = parent;
        this.isMainGroup = isMainGroup;
        this.focused = focused.slice(0);
        this.boardSettings = boardSettings;
        // Create the group element
        this.createElement();
        // Create the boards
        this.createBoards();
        // Add the listeners
        this.addListeners();
    }

    createElement() {
        // Create the group element
        this.elements.container = document.createElement('div');
        this.elements.container.className = 'focus-group-container';
        // Create the header container element
        this.elements.header = document.createElement('div');
        this.elements.header.className = 'focus-group-header'
        // Create the group header element
        this.elements.groupHeader = document.createElement('h2');
        this.elements.groupHeader.className = 'title is-size-5 m-0';
        this.elements.groupHeader.innerHTML = this.isMainGroup ? 'Ungrouped' : 'Grouped';
        // Add to the header
        this.elements.header.appendChild(this.elements.groupHeader);
        // Create the button container
        const buttons = document.createElement('div');
        // Create the practice button
        this.elements.practiceButton = document.createElement('button');
        this.elements.practiceButton.type = 'button';
        this.elements.practiceButton.className = 'button is-small mr-1';
        this.elements.practiceButton.innerHTML = `
            <span class="icon">
                <i class="fa-solid fa-gamepad"></i>
            </span>
            <span>Practice</span>
        `;
        // Add to the buttons
        buttons.appendChild(this.elements.practiceButton);
        // Create zoom out button
        this.elements.zoomOutButton = document.createElement('button');
        this.elements.zoomOutButton.type = 'button';
        this.elements.zoomOutButton.className = 'button is-small mr-1';
        this.elements.zoomOutButton.innerHTML = `
            <span class="icon">
                <i class="fa-solid fa-magnifying-glass-minus"></i>
            </span>
        `;
        // Add to the buttons
        buttons.appendChild(this.elements.zoomOutButton);
        // Create zoom in button
        this.elements.zoomInButton = document.createElement('button');
        this.elements.zoomInButton.type = 'button';
        this.elements.zoomInButton.className = 'button is-small';
        this.elements.zoomInButton.innerHTML = `
            <span class="icon">
                <i class="fa-solid fa-magnifying-glass-plus"></i>
            </span>
        `;
        // Add to the buttons
        buttons.appendChild(this.elements.zoomInButton);
        // Add it to the header
        this.elements.header.appendChild(buttons);
        // Create the board container element
        this.elements.boardContainer = document.createElement('div');
        this.elements.boardContainer.className = 'focus-group-board-container';
        // Add to the group element
        this.elements.container.appendChild(this.elements.header);
        this.elements.container.appendChild(this.elements.boardContainer);
    }

    createBoards() {
        // Reset the boards
        this.boards = [];
        // Add the boards
        for (let i=0;i<this.focused.length;i++) {
            // Create the focus board
            const board = new focusBoard(this, this.focused[i], this.boardSettings);
            // Add it to the container
            this.elements.boardContainer.appendChild(board.getElement());
            // Keep track of the boards created
            this.boards.push(board);
        }
    }

    addListeners() {
        // Catch board selection
        this.elements.container.addEventListener("focusBoard:select", e => {
            this.onSelectBoard(e.detail.board);
        });
        // Catch board deselection
        this.elements.container.addEventListener("focusBoard:deselect", e => {
            this.onDeselectBoard(e.detail.board);
        });
        // Practice button
        this.elements.practiceButton.addEventListener("click", e => {
            // Dispatch a custom event, group or manager can catch it
            this.parent.dispatchEvent(
                new CustomEvent('focusGroup:practice', {
                    bubbles: true,
                    detail: {
                        group: this,
                        lines: this.focused
                    }
                })
            );
        });
        // Zoom out button
        this.elements.zoomOutButton.addEventListener("click", e => {
            this.zoomOut();
        });
        // Zoom in button
        this.elements.zoomInButton.addEventListener("click", e => {
            this.zoomIn();
        });
    }

    zoomOut() {
        // Safety check
        if (this.boardSize.current <= this.boardSize.min) return;
        // Decrease the board size
        this.boardSize.current -= this.boardSize.step;
        this.elements.boardContainer.style.setProperty('--size', this.boardSize.current + 'px');
        // Toggle buttons
        this.elements.zoomOutButton.disabled = this.boardSize.current <= this.boardSize.min;
        this.elements.zoomInButton.disabled = false;
    }

    zoomIn() {
        // Safety check
        if (this.boardSize.current >= this.boardSize.max) return;
        // Increase the board size
        this.boardSize.current += this.boardSize.step;
        this.elements.boardContainer.style.setProperty('--size', this.boardSize.current + 'px');
        // Toggle buttons
        this.elements.zoomOutButton.disabled = false;
        this.elements.zoomInButton.disabled = this.boardSize.current >= this.boardSize.max;
    }

    getElement() {
        return this.elements.container;
    }

    isSelected() {
        return this.getSelectedBoard() !== null;
    }

    getSelectedBoard() {

        console.log('getSelectedBoard:', this.boards);

        for (let i=0;i<this.boards.length;i++) {
            if (this.boards[i].isSelected()) return this.boards[i];
        }
        return null;
    }

    addBoard(board) {
        // Update the board group
        board.group = this;
        // Add the board
        this.boards.push(board);
        this.focused.push(board.move);
        // Add the board element
        this.elements.boardContainer.appendChild(board.getElement());

        return this.boards.length;
    }

    removeBoard(board) {
        const idx = this.boards.indexOf(board);

        console.log('FocusGroup:removeBoard', idx, board, this.boards);

        if (idx === -1) return this.boards.length;

        // Remove the element from the group
        const boardElement = board.getElement();
        boardElement.parentNode.removeChild(boardElement);
        // Remove from the arrays
        this.focused.splice(idx, 1);
        this.boards.splice(idx, 1);

        return this.boards.length;
    }

    onSelectBoard(board) {

        console.log('onSelectBoard', board);

        // Deselect all boards
        this.deselectAll();
        // Select the active board
        this.selectBoard(board);
        // Toggle connect/disconnect buttons
        this.toggleConnectDisconnect(true);
    }

    onDeselectBoard(board) {

        console.log('onDeselectBoard', board);

        // Deselect the active board
        this.deselectBoard(board);
        // Toggle connect/disconnect buttons
        this.toggleConnectDisconnect(false);
    }

    selectBoard(board) {
        // Get the board container element
        const boardContainer = board.getElement();
        
        console.log('selectBoard', board, boardContainer);
        
        // Select it
        boardContainer.classList.add('is-selected');
        // Toggle connect/disconnect icons
        board.elements.buttons.connect.classList.add('is-hidden');
        if (this.isMainGroup) {
            board.elements.buttons.disconnect.classList.add('is-hidden');
        } else {
            board.elements.buttons.disconnect.classList.remove('is-hidden');
        }
    }

    deselectBoard(board) {
        // Get the board container element
        const boardContainer = board.getElement();
        
        console.log('DeselectBoard', board, boardContainer);
        
        // Deselect it
        boardContainer.classList.remove('is-selected');
    }

    // Deselect all
    deselectAll() {

        console.log('DeselectAll', this);

        // Unselect all boards
        for (let i=0;i<this.boards.length;i++) {
            this.deselectBoard(this.boards[i]);
        }
    }

    // Toggles the connect icon for all boards
    toggleConnectDisconnect(isAnySelected = false) {
        for (let i=0;i<this.boards.length;i++) {
            // Allow connect if main group, not selected and another board is selected
            if (this.isMainGroup && isAnySelected && !this.boards[i].isSelected()) {
                this.boards[i].elements.buttons.connect.classList.remove('is-hidden');
            } else {
                this.boards[i].elements.buttons.connect.classList.add('is-hidden');
            }
            // Allow disconnect if not main group
            if (this.isMainGroup) {
                this.boards[i].elements.buttons.disconnect.classList.add('is-hidden');
            } else {
                this.boards[i].elements.buttons.disconnect.classList.remove('is-hidden');
            }
        }
    }
}