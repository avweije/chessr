import { Chess } from "chess.js/dist/esm/chess.js";
import { Chessboard, FEN } from "cm-chessboard/src/Chessboard.js";
import {
  ChessboardView,
  COLOR,
  INPUT_EVENT_TYPE,
  BORDER_TYPE,
  POINTER_EVENTS,
} from "cm-chessboard/src/view/ChessboardView.js";
import {
  MARKER_TYPE,
  Markers,
} from "cm-chessboard/src/extensions/markers/Markers.js";

import "../styles/repertoire.css";

/*
MyChessBoard Class - Integrates Chess.js with cm-chessboard, validates moves, adds markers, etc.
*/
export class MyChessBoard {
  board = null;
  game = null;

  lastMove = "";

  constructor() {
    this.game = new Chess();
  }

  /*
  Initialise the chessboard.

  @params:
  - boardElement: the container element for displaying the chessboard
  - color: the initial orientation of the chessboard.
  */

  init(boardElement, color = COLOR.white) {
    // create the chess board
    this.board = new Chessboard(boardElement, {
      position: FEN.start,
      orientation: color,
      assetsUrl: "/build/", // wherever you copied the assets folder to, could also be in the node_modules folder
      style: {
        cssClass: "default", // set the css theme of the board, try "green", "blue" or "chess-club"
        showCoordinates: true, // show ranks and files
        aspectRatio: 1, // height/width of the board
        animationDuration: 300, // pieces animation duration in milliseconds. Disable all animations with `0`
      },
      extensions: [{ class: Markers }],
    });
  }

  /*
  Public functions.
  */

  // enable move input
  enableMoveInput() {
    this.board.enableMoveInput(this.moveInputHandler.bind(this));
  }

  // disable move input
  disableMoveInput() {
    this.board.disableMoveInput();
  }

  // make a move
  makeMove(move) {
    try {
      // make the move
      this.game.move(move);
      // set the new position
      this.board.setPosition(this.game.fen());

      // remember the last move ?

      this.afterMove(move);
    } catch (err) {
      console.log(err);
    }
  }

  // jump to a certain position
  jumpToMove(index) {
    try {
      // get the history of moves
      var moves = this.game.history({ verbose: true });

      // reset the game and make the moves
      this.game.reset();
      for (var i = 0; i <= index; i++) {
        this.game.move(moves[i].san);
      }

      // remember last move
      this.lastMove = moves[index].san;

      // set the board position
      this.board.setPosition(this.game.fen());

      this.afterMove(moves[index]);
    } catch (err) {
      console.log(err);
    }
  }

  /*
  Public event handlers, override in extended class.
  - onValidateMove: called when a legal move is being made, return false to cancel the move
  - afterMove: called after a legal move was made
  - afterIllegalMove: called after an illegal move was made
  */
  onValidateMove(move) {
    return true;
  }

  afterMove(move) {}

  afterIllegalMove(move) {}

  /*
  Private event handlers.
   */

  moveInputHandler(event) {
    switch (event.type) {
      case INPUT_EVENT_TYPE.moveInputStarted:
        return this.moveInputStarted(event);
      case INPUT_EVENT_TYPE.validateMoveInput:
        return this.validateMoveInput(event);
      case INPUT_EVENT_TYPE.moveInputCanceled:
        this.moveInputCancelled(event);
        break;
      case INPUT_EVENT_TYPE.moveInputFinished:
        this.moveInputFinished(event);
        break;
      case INPUT_EVENT_TYPE.movingOverSquare:
        break;
    }
  }

  moveInputStarted(event) {
    // do not pick up pieces if the game is over
    if (this.game.isGameOver()) return false;

    var piece = this.board.getPiece(event.squareFrom);

    // only pick up pieces for the side to move
    if (
      (this.game.turn() === "w" && piece.search(/^b/) !== -1) ||
      (this.game.turn() === "b" && piece.search(/^w/) !== -1)
    ) {
      return false;
    }

    var moves = [];
    for (const move of this.game.moves({ square: event.squareFrom })) {
      // remove the piece notation and other characters to just get the square
      var t = move
        .replace(/^[RNBKQ]x?/, "")
        .replace("!", "")
        .replace("#", "");

      moves.push({ from: event.squareFrom, to: t });
    }

    // show the legal moves
    this.board.addLegalMovesMarkers(moves);

    return true;
  }

  validateMoveInput(event) {
    try {
      // see if the move is legal
      var move = this.game.move({
        from: event.squareFrom,
        to: event.squareTo,
        promotion: "q", // NOTE: always promote to a queen for example simplicity
      });

      if (this.onValidateMove(move)) {
        // remember the last move made
        this.lastMove = event.squareFrom + event.squareTo;

        // set the board position
        this.board.setPosition(this.game.fen());

        this.afterMove();

        return true;
      } else {
        // undo the move
        this.game.undo();

        return false;
      }
    } catch (err) {
      console.log(err);

      return false;
    }
  }

  moveInputCancelled(event) {
    // remove the legal move markers
    this.board.removeLegalMovesMarkers();
  }

  moveInputFinished(event) {
    // process the move
    this.afterMakeMove();
  }

  // called after a move was made
  afterMakeMove() {
    // remove the legal move markers
    this.board.removeLegalMovesMarkers();

    // get the last move
    var last = this.game.history({ verbose: true }).pop();
    // add marker for last move
    this.board.removeMarkers();
    this.board.addMarker(MARKER_TYPE.square, last.from);
    this.board.addMarker(MARKER_TYPE.square, last.to);
  }
}
