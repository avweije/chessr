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

import "../styles/chessboard.css";

/*
MyChessBoard Class - Integrates Chess.js with cm-chessboard, validates moves, adds markers, etc.
*/
export class MyChessBoard {
  board = null;
  game = null;

  // the custom markers
  markers = {
    checkmark: {
      class: "marker-checkmark",
      slice: "markerCheckmark",
    },
    cancel: {
      class: "marker-cancel",
      slice: "markerCancel",
    },
  };

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
      extensions: [
        {
          class: Markers,
          props: { sprite: "/build/extensions/markers/markers.svg" },
        },
      ],
    });
  }

  /*
  Public functions.
  */

  // enable move input
  enableMoveInput() {
    console.log("enableMoveInput");

    try {
      this.board.enableMoveInput(this.moveInputHandler.bind(this));
    } catch (err) {
      console.log(err);
    }
  }

  // disable move input
  disableMoveInput() {
    console.log("disableMoveInput");

    try {
      this.board.disableMoveInput();
    } catch (err) {
      console.log(err);
    }
  }

  // get the correct FEN notation (en passant rule not included if not actually possible, should always be included if pawn moved 2 squares)
  getFen() {
    console.log("getFEN:");

    // the en passant notation
    var enPassant = "-";
    // get the last move
    var last = this.game.history({ verbose: true }).pop();
    // if the last move was a pawn move
    if (last && last.piece == "p") {
      // if the pawn moved 2 squares
      if (last.from.charAt(1) == "2" && last.to.charAt(1) == "4") {
        enPassant = last.from.charAt(0) + "3";
      } else if (last.from.charAt(1) == "7" && last.to.charAt(1) == "5") {
        enPassant = last.from.charAt(0) + "6";
      }
    }

    // split the game FEN
    var fenParts = this.game.fen().split(" ");
    // override the en passant part
    fenParts[3] = enPassant;

    return fenParts.join(" ");
  }

  // get the history(verbose=true) with the corrent FEN's
  historyWithCorrectFen() {
    var updatedFen = "";
    // get the history
    var history = this.game.history({ verbose: true });
    for (var i = 0; i < history.length; i++) {
      // if the previous fen was updated
      if (updatedFen != "") {
        history[i].before = updatedFen;

        updatedFen = "";
      }

      // if the move was a pawn move
      if (history[i].piece == "p") {
        // the en passant notation
        var enPassant = "-";
        // if the pawn moved 2 squares
        if (
          history[i].from.charAt(1) == "2" &&
          history[i].to.charAt(1) == "4"
        ) {
          enPassant = history[i].from.charAt(0) + "3";
        } else if (
          history[i].from.charAt(1) == "7" &&
          history[i].to.charAt(1) == "5"
        ) {
          enPassant = history[i].from.charAt(0) + "6";
        }

        // if we have an en passant move
        if (enPassant != "-") {
          // split the game FEN
          var fenParts = history[i].after.split(" ");
          // override the en passant part
          fenParts[3] = enPassant;
          // update the FEN
          updatedFen = fenParts.join(" ");
          history[i].after = updatedFen;
        }
      }
    }

    return history;
  }

  // make a move
  makeMove(move) {
    try {
      // make the move
      this.game.move(move);
      // set the new position
      this.board.setPosition(this.game.fen());

      console.log("makeMove (getFEN):");
      console.log(this.getFen());

      // process the move
      this.afterMakeMove();
      // call the after move event
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

      // set the board position
      this.board.setPosition(this.game.fen());

      // call the after move event
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
    console.log("validateMoveInput:");
    console.log(event);
    try {
      // see if the move is legal
      var move = this.game.move({
        from: event.squareFrom,
        to: event.squareTo,
        promotion: "q", // NOTE: always promote to a queen for example simplicity
      });

      if (this.onValidateMove(move)) {
        // set the board position
        this.board.setPosition(this.game.fen());

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
    console.log("moveInputFinished:");
    console.log(event);

    // process the move
    this.afterMakeMove();
    // if this was a legal move
    if (event.legalMove) {
      // call the after move event
      this.afterMove(this.game.history({ verbose: true }).pop());
    }
  }

  // called after a move was made
  afterMakeMove() {
    console.log("afterMakeMove:");

    // remove the legal move markers
    this.board.removeLegalMovesMarkers();

    // get the last move
    var last = this.game.history({ verbose: true }).pop();

    // add marker for last move
    this.board.removeMarkers();
    if (last) {
      this.board.addMarker(MARKER_TYPE.square, last.from);
      this.board.addMarker(MARKER_TYPE.square, last.to);
    }
  }
}
