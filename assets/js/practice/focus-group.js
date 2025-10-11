import { FocusBoard } from "focus-board";

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
export class FocusBoardGroup {
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
        zoomInButton: null,
        toggleButton: null
    };

    // Used for zoom in/out, set initial size to same as in CSS
    boardSize = {
        current: 350,
        min: 200,
        max: 550,
        step: 50
    };

    // The FocusBoards collection
    boards = [];
    // The ECO names for all the boards, used to determine the group name
    ecos = [];

    constructor(parent, isMainGroup, focused, boardSettings) {

        console.log('FocusBoardGroup constructor', focused);

        this.parent = parent;
        this.isMainGroup = isMainGroup;
        this.focused = focused.slice(0);
        this.boardSettings = boardSettings;
        // Create the group element
        this.createElement();
        // Create the boards
        this.createBoards();
        // Update the group name
        this.updateGroupName();
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
        this.elements.groupHeader.innerHTML = '';
        // Add to the header
        this.elements.header.appendChild(this.elements.groupHeader);
        // Create the button container
        const buttons = document.createElement('div');
        // Create the practice button
        this.elements.practiceButton = document.createElement('button');
        this.elements.practiceButton.type = 'button';
        this.elements.practiceButton.title = 'Open in practice';
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
        this.elements.zoomOutButton.title = 'Zoom out';
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
        this.elements.zoomInButton.title = 'Zoom in';
        this.elements.zoomInButton.className = 'button is-small mr-1';
        this.elements.zoomInButton.innerHTML = `
            <span class="icon">
                <i class="fa-solid fa-magnifying-glass-plus"></i>
            </span>
        `;
        // Add to the buttons
        buttons.appendChild(this.elements.zoomInButton);
        // Create toggle button
        this.elements.toggleButton = document.createElement('button');
        this.elements.toggleButton.type = 'button';
        this.elements.toggleButton.title = 'Hide group';
        this.elements.toggleButton.className = 'button is-small';
        this.elements.toggleButton.innerHTML = `
            <span class="icon">
                <i class="fa-solid fa-caret-up"></i>
            </span>
        `;
        // Add to the buttons
        buttons.appendChild(this.elements.toggleButton);
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
        for (let i = 0; i < this.focused.length; i++) {
            // Create the focus board
            const board = new FocusBoard(this, this.focused[i], this.boardSettings);
            // Add it to the container
            this.elements.boardContainer.appendChild(board.getElement());
            // Keep track of the boards created
            this.boards.push(board);
        }
    }

    updateGroupName() {
        // The main group name
        let groupName = 'Ungrouped';
        // Determine the name if not the main group
        if (!this.isMainGroup) {
            // Get the ECO names
            this.getEcoNames();
            // Determine the group name
            groupName = this.getGroupNameFromECO(this.ecos);
            // Fallback
            if (groupName === '') groupName = 'Grouped';
        }
        // Update the group name
        this.elements.groupHeader.innerHTML = groupName;
    }

    getEcoNames() {
        // Get the ECO names
        this.ecos = [];
        for (let i = 0; i < this.focused.length; i++) {
            if (this.focused[i].eco?.name) this.ecos.push(this.focused[i].eco.name);
        }
    }

    addListeners() {
        // Catch board selection
        this.elements.container.addEventListener("FocusBoard:select", e => {
            this.onSelectBoard(e.detail.board);
        });
        // Catch board deselection
        this.elements.container.addEventListener("FocusBoard:deselect", e => {
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
                        lines: [...this.focused] // pass a copy instead of a reference
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
        // Toggle button
        this.elements.toggleButton.addEventListener("click", e => {
            this.toggleGroup();
        });
    }

    /**
     * Generate a group name from ECO names of boards using majority word matching.
     *
     * @param {string[]} ecoNames - Array of ECO names
     * @returns {string} Group name
     */
    getGroupNameFromECO(ecoNames) {
        if (!ecoNames || ecoNames.length === 0) return '';

        // Split each ECO name into words
        const wordsPerName = ecoNames.map(name => name.split(' '));

        let groupNameWords = [];
        let remainingIndexes = wordsPerName.map((_, idx) => idx);
        let wordPos = 0;

        while (remainingIndexes.length > 0) {
            const counts = {};

            // Count the words at this position for remaining boards
            remainingIndexes.forEach(idx => {
                const word = wordsPerName[idx][wordPos];
                if (word) counts[word] = (counts[word] || 0) + 1;
            });

            if (Object.keys(counts).length === 0) break; // no words left

            // Find majority word
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const [topWord, topCount] = sorted[0];
            const total = remainingIndexes.length;

            // Stop if no clear majority (<=50%)
            if (topCount <= total / 2) break;

            // Append majority word
            groupNameWords.push(topWord);

            // Keep only boards that have this word at this position
            remainingIndexes = remainingIndexes.filter(idx => wordsPerName[idx][wordPos] === topWord);

            // Stop if only one board left
            if (remainingIndexes.length <= 1) break;

            wordPos++;
        }

        // Fallback: if nothing added, take first ECO name
        if (groupNameWords.length === 0) return ecoNames[0] + ' ***';

        return groupNameWords.join(' ').replace(/[^a-zA-Z0-9]+$/, '');
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

    toggleGroup() {
        // is-collapsed
        // Toggle the board container
        if (this.elements.boardContainer.classList.contains('is-collapsed')) {
            // Show the board container
            this.elements.boardContainer.classList.remove('is-collapsed');
            // Update the button icon
            this.elements.toggleButton.innerHTML = '<span class="icon"><i class="fa-solid fa-caret-up"></i></span>';
            this.elements.toggleButton.title = 'Hide group';
            // Show the other buttons
            this.elements.practiceButton.classList.remove('is-hidden');
            this.elements.zoomOutButton.classList.remove('is-hidden');
            this.elements.zoomInButton.classList.remove('is-hidden');
        } else {
            // Hide the board container
            this.elements.boardContainer.classList.add('is-collapsed')
            // Update the button icon
            this.elements.toggleButton.innerHTML = '<span class="icon"><i class="fa-solid fa-caret-down"></i></span>';
            this.elements.toggleButton.title = 'Show group';
            // Hide the other buttons
            this.elements.practiceButton.classList.add('is-hidden');
            this.elements.zoomOutButton.classList.add('is-hidden');
            this.elements.zoomInButton.classList.add('is-hidden');
        }
    }

    getElement() {
        return this.elements.container;
    }

    isSelected() {
        return this.getSelectedBoard() !== null;
    }

    getSelectedBoard() {

        console.log('getSelectedBoard:', this.boards);

        for (let i = 0; i < this.boards.length; i++) {
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
        // Update the group name
        this.updateGroupName();

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
        // Update the group name
        this.updateGroupName();

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
        for (let i = 0; i < this.boards.length; i++) {
            this.deselectBoard(this.boards[i]);
        }
    }

    // Toggles the connect icon for all boards
    toggleConnectDisconnect(isAnySelected = false) {
        for (let i = 0; i < this.boards.length; i++) {
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