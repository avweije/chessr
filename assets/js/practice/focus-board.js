import { MyChess } from "chess";
import {
    MyChessBoard, CUSTOM_MARKER_TYPE, BOARD_STATUS, BOARD_SETTINGS, PIECE_TILESIZE,
} from "chessboard";
import { CUSTOM_ARROW_TYPE } from "ThickerArrows";
import { COLOR } from "../../vendor/cm-chessboard/src/view/ChessboardView.js";
import { Markers } from "../../vendor/cm-chessboard/src/extensions/markers/Markers.js";
import { Utils } from "utils";
import { ThickerArrows } from "ThickerArrows";

import "../../styles/chessboard.css";

/**
 * Chessboard with action buttons and notes for the focus moves.
 * 
 * Creates the element containing the board, the action buttons and the notes.
 * 
 * Do we need a getElement function? or create with container parameter?
 * The group needs to have a getElement so we can move it to another group.
 * 
 * Load position on create.
 * 
 * Option to animate to position.
 * Option to highlight or animate the move.
 * 
 * 
 * Callbacks:
 * - onSelect     : group: make board 'active', other boards in group inactive, connect icons in ungrouped activated.
 * - onConnect    : manager: connects this board to active board. adds to new group if not in actual group yet
 * - onDisconnect : manager: removes from 1 group, adds to ungrouped group
 * 
 * Functions:
 * - Animate      : activated through button/iconm, part of board
 * - Show         : show move, animate it? show move markers? arrows..
 * - Unfocus      : manager: call onRemove ? remove the position from focus moves? 
 */
export class FocusBoard {
    group = null;
    move = null;
    settings = null;

    color = 'white';
    board = null;

    isAnimating = false;
    isShowing = false;

    elements = {
        container: null,
        header: null,
        board: null,
        boardSelector: null,
        buttons: {
            connect: null,
            disconnect: null,
            animate: null,
            show: null,
            repertoire: null,
            unfocus: null
        },
        notes: {
            container: null,
            textArea: null
        }
    };

    constructor(group, move, settings = {}) {

        console.log('FocusBoard constructor', group, move);

        // Store the move
        this.group = group;
        this.move = move;
        this.settings = settings;
        // Get the elements
        this.getElements();
        // Create the focus board element
        this.createElement();
        // Get the color
        this.color = move?.color ?? 'white';
        // Create the chessboard
        this.createChessboard();
        // Add the listeners
        this.addListeners();
        // Show the position
        this.board.board.setPosition(this.move?.after ?? '', false);
    }

    // Get the required elements
    getElements() {
        // Get the data-elements for reference
        //this.elements = {};
        document.querySelectorAll("[data-element]").forEach(el => {
            if (el.dataset.element !== "yes") return;
            this.elements[el.id] = el;
        });

        // get the practice type
        this.type = this.elements.board.getAttribute("data-type");
        // get the repertoire id (from the roadmap)
        this.repertoireId = this.elements.board.getAttribute("data-id");
    }

    // Creates the focus board element
    createElement() {
        // Create the focus board container element
        this.elements.container = document.createElement('div');
        this.elements.container.className = 'box focus-board-container';

        // Create the board header (ECO)
        if (this.move.eco) {
            this.elements.header = document.createElement('div');
            this.elements.header.className = 'focus-board-header is-size-7 is-ellipsis';
            this.elements.header.innerHTML = this.move.eco.name + ' [' + this.move.eco.code + ']';
        }

        // Create the board element
        this.elements.board = document.createElement('div');
        this.elements.board.className = 'focus-board-element';

        // Create the overlay element to catch hover and click to make active
        this.elements.boardSelector = document.createElement('div');
        this.elements.boardSelector.className = 'focus-board-selector';

        // Create the action buttons
        this.elements.buttons.container = document.createElement('div');
        this.elements.buttons.container.className = 'focus-board-buttons';

        this.elements.buttons.connect = document.createElement('button');
        this.elements.buttons.connect.type = 'button';
        this.elements.buttons.connect.className = 'is-hidden button is-primary is-small is-align-self-start';
        this.elements.buttons.connect.innerHTML = '<span class="icon"><i class="fa-solid fa-link"></i></span>';
        this.elements.buttons.connect.title = 'Connect to selected';

        this.elements.buttons.disconnect = document.createElement('button');
        this.elements.buttons.disconnect.type = 'button';
        this.elements.buttons.disconnect.className = 'is-hidden button is-primary is-small is-align-self-start';
        this.elements.buttons.disconnect.innerHTML = '<span class="icon"><i class="fa-solid fa-unlink"></i></span>';
        this.elements.buttons.disconnect.title = 'Disconnect from group';

        this.elements.buttons.animate = document.createElement('button');
        this.elements.buttons.animate.type = 'button';
        this.elements.buttons.animate.className = 'button is-small';
        this.elements.buttons.animate.innerHTML = '<span class="icon"><i class="fa-solid fa-play"></i></span>';
        this.elements.buttons.animate.title = 'Animate to position';

        this.elements.buttons.show = document.createElement('button');
        this.elements.buttons.show.type = 'button';
        this.elements.buttons.show.className = 'button is-small';
        this.elements.buttons.show.innerHTML = '<span class="icon"><i class="fa-solid fa-eye"></i></span>';
        this.elements.buttons.show.title = 'Show the correct move';

        this.elements.buttons.repertoire = document.createElement('button');
        this.elements.buttons.repertoire.type = 'button';
        this.elements.buttons.repertoire.className = 'button is-small';
        this.elements.buttons.repertoire.innerHTML = '<span class="icon"><i class="fa-solid fa-up-right-from-square"></i></span>';
        this.elements.buttons.repertoire.title = 'Open in repertoire';

        this.elements.buttons.unfocus = document.createElement('button');
        this.elements.buttons.unfocus.type = 'button';
        this.elements.buttons.unfocus.className = 'button is-small';
        this.elements.buttons.unfocus.innerHTML = '<span class="icon"><i class="fa-solid fa-thumbtack-slash"></i></span>';
        this.elements.buttons.unfocus.title = 'Remove from focused';

        // Get the accuracy percentage
        let count = 0;
        let failed = 0;
        for (let i=0;i<this.move.moves.length;i++) {
            count += this.move.moves[i].stats.attempts;
            failed += this.move.moves[i].stats.failed;
        }

        const successPct = 1 - (failed / count);
        const accuracyIdx = Math.min(2, Math.floor(successPct * 3));
        //const accuracyTypes = ['is-danger', 'is-warning', 'is-success'];
        const accuracyTypes = ['has-background-danger', 'has-background-warning', 'has-background-success'];

        // Create the accuracy tag
        const accuracyTag = document.createElement('div');
        //accuracyTag.className = `tag ${accuracyTypes[accuracyIdx]} is-light px-1 mb-5`;
        //accuracyTag.innerHTML = Math.round(successPct * 100) + '%';
        accuracyTag.className = `dot-marker mb-2 ${accuracyTypes[accuracyIdx]}`;

        // Add the buttons to separate containers so we can have buttons at top and bottom
        const topButtons = document.createElement('div');
        topButtons.appendChild(this.elements.buttons.connect);
        topButtons.appendChild(this.elements.buttons.disconnect);

        const bottomButtons = document.createElement('div');
        bottomButtons.className = 'is-align-items-center'
        bottomButtons.appendChild(accuracyTag);
        bottomButtons.appendChild(this.elements.buttons.animate);
        bottomButtons.appendChild(this.elements.buttons.show);
        bottomButtons.appendChild(this.elements.buttons.repertoire);
        bottomButtons.appendChild(this.elements.buttons.unfocus);

        this.elements.buttons.container.appendChild(topButtons);
        this.elements.buttons.container.appendChild(bottomButtons);

        // Create the notes
        this.elements.notes.container = document.createElement('div');
        this.elements.notes.container.className = 'focus-board-notes message is-info is-flex';

        const bulmaNotification = document.createElement('div');
        bulmaNotification.className = 'message-body w-full';

        this.elements.notes.textArea = document.createElement('textarea');
        this.elements.notes.textArea.className = 'textarea';
        this.elements.notes.textArea.value = this.move?.notes ?? '';

        bulmaNotification.appendChild(this.elements.notes.textArea);
        this.elements.notes.container.appendChild(bulmaNotification);

        // Add the elements
        const boardAndSelector = document.createElement('div');
        boardAndSelector.className = 'focus-board-and-selector';
        boardAndSelector.appendChild(this.elements.board);
        boardAndSelector.appendChild(this.elements.boardSelector);

        const boardAndButtons = document.createElement('div');
        boardAndButtons.className = 'focus-board-and-buttons';

        boardAndButtons.appendChild(boardAndSelector);
        boardAndButtons.appendChild(this.elements.buttons.container);

        // Add the ECO header if we have one
        if (this.move.eco) {
            this.elements.container.appendChild(this.elements.header);
        }
        // Add the board and notes
        this.elements.container.appendChild(boardAndButtons);
        this.elements.container.appendChild(this.elements.notes.container);
    }

    // Add the listeners
    addListeners() {
        // Select a focus board element
        this.elements.boardSelector.addEventListener("click", () => {
            if (this.isSelected()) {
                this.bubbleEvent("deselect");
            } else {
                this.bubbleEvent("select");
            }
        });
        // Connect button
        this.elements.buttons.connect.addEventListener("click", () => {
            this.bubbleEvent("connect");
        });
        // Disconnect button
        this.elements.buttons.disconnect.addEventListener("click", () => {
            this.bubbleEvent("disconnect");
        });
        // Animate button
        this.elements.buttons.animate.addEventListener("click", () => {
            this.animate();
        });
        // Show button
        this.elements.buttons.show.addEventListener("click", () => {
            this.show();
        });
        // Open in repertoire button
        this.elements.buttons.repertoire.addEventListener("click", () => {
            this.openInRepertoire();
        });
        // Unfocus button (remove as focus move)
        this.elements.buttons.unfocus.addEventListener("click", () => {
            this.bubbleEvent("unfocus");
        });
        // Notes
        this.elements.notes.textArea.addEventListener("change", () => {
            // Update the notes
            this.move.notes = this.elements.notes.textArea.value;
            // Bubble the event so the manager can save to DB
            this.bubbleEvent('notes', { 
                id: this.move.id,
                notes: this.elements.notes.textArea.value
            });
        });
    }

    bubbleEvent(event, details = null) {
        // Dispatch a custom event, group or manager can catch it
        this.elements.container.dispatchEvent(
            new CustomEvent('FocusBoard:' + event, {
                bubbles: true,
                detail: details ?? { group: this.group, board: this }
            })
        );
    }

    // Returns the focus board element
    getElement() {
        return this.elements.container;
    }

    // Returns true if this is the currently selected board
    isSelected() {
        return this.elements.container.classList.contains('is-selected');
    }


    /* Actions */

    async animate() {
        // Safety check
        if (this.isAnimating) return false;

        // Start animating
        this.isAnimating = true;

        // Get the moves
        const moves = [...this.move.line, this.move.move];

        console.log(this.board);

        // Reset the game and make the moves
        this.board.game.reset();
        // Update the board
        this.board.board.setPosition(this.board.getFen());

        // Make the moves so we can get the from and to
        for (let i = 0; i < moves.length; i++) {
            this.board.game.move(moves[i]);
        }
        // Get the history
        const history = this.board.game.history({ verbose: true });

        // Animate the moves
        for (let i = 0; i < history.length; i++) {
            await this.board.board.movePiece(history[i]["from"], history[i]["to"], true);
        }

        this.isAnimating = false;
    }

    show() {
        // Already showing or not
        //const arrows = this.board.board.getArrows();
        
        //console.log(this.move, arrows, this.board.getFen(), this.board.game.history());

        // Toggle the show button
        //this.toggleShowButton(arrows && arrows.length > 0);
        this.toggleShowButton(this.isShowing);

        // Toggle the status
        this.isShowing = !this.isShowing;

        // If we need to remove the markers
        if (!this.isShowing) {
            this.board.board.removeMarkers();

            return;
        }

        // load the FEN
        this.board.game.load(this.move.after);

        console.log('Loaded FEN:', this.move.after);

        const moves = [];
        // Make the move(s) so we get the from and to
        try {
            for (let i=0;i<this.move.moves.length;i++) {
                // Make the move and get the move details
                moves.push(this.board.game.move(this.move.moves[i].move));
                // Undo the move
                this.board.game.undo();
            }
        } catch (err) {
            console.warn(err);
        }

        console.log('Moves:', moves);
        
        // Add the arrow(s)
        for (let i=0;i<moves.length;i++) {
            //this.board.board.addArrow(CUSTOM_ARROW_TYPE.normal, moves[i].from, moves[i].to);

            //console.log('Added arrow from', moves[i].from, 'to', moves[i].to);

            // Add the move markers
            this.board.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, moves[i].from);
            this.board.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, moves[i].to);
        }
    }

    
  // Open the position in the repertoire
  openInRepertoire() {
    // Clear the form
    this.elements.repertoireForm.innerHTML = '';
    // Set the form action to the repertoire color
    this.elements.repertoireForm.action = "./repertoire/" + this.move.color;
    // Create the FEN field
    const inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = "fen";

    this.elements.repertoireForm.appendChild(inp);

    // Get the moves
    const moves = [...this.move.line, this.move.move];
    // Create a field for each move
    for (let i = 0; i < moves.length; i++) {
      const inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = moves[i];

      this.elements.repertoireForm.appendChild(inp);
    }
    // Submit the form
    this.elements.repertoireForm.submit();
  }

    // create or update the chessboard
    createChessboard() {
        try {
            // if we are updating
            if (this.board) {
                // destroy the current board
                this.board.destroy();
                this.board = null;
            }
            // the board settings
            const boardSettings = {
                orientation: this.color == 'black' ? COLOR.black : COLOR.white,
                style: {
                    pieces: {},
                },
            };
            if (this.settings.board) {
                boardSettings.style.cssClass = this.settings.board;
            }
            if (this.settings.pieces) {
                boardSettings.style.pieces.file = "pieces/" + this.settings.pieces;
                boardSettings.style.pieces.tileSize = PIECE_TILESIZE.get(this.settings.pieces);
            }
            if (this.settings.animation) {
                boardSettings.style.animationDuration = this.settings.animation;
            }

            // Create the chess board
            this.board = new MyChessBoard();
            this.board.init(this.elements.board, boardSettings);
        } catch (err) {
            console.warn(err);
        }
    }

    toggleShowButton(toggle) {
        this.elements.buttons.show.innerHTML = toggle ? 
            '<span class="icon"><i class="fa-solid fa-eye"></i></span>'
            : '<span class="icon"><i class="fa-solid fa-eye-slash"></i></span>';
        this.elements.buttons.show.title = toggle ? 
            'Show the correct move' : 'Hide the correct move';
    }
}