//import { Chess } from "chess.js/dist/esm/chess.js";
import { MyChess } from "chess";
import { Chessboard, FEN } from "../cm-chessboard/src/Chessboard.js";
import {
  COLOR,
  INPUT_EVENT_TYPE,
} from "../cm-chessboard/src/view/ChessboardView.js";
import {
  MARKER_TYPE,
  Markers,
} from "../cm-chessboard/src/extensions/markers/Markers.js";
import { PromotionDialog } from "../cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js";
import {
  ARROW_TYPE,
  Arrows,
} from "../cm-chessboard/src/extensions/arrows/Arrows.js";
import { ThickerArrows } from "./ThickerArrows.js";
import { PgnField } from "pgn-field";

import "../styles/chessboard.css";
import "../cm-chessboard/assets/extensions/promotion-dialog/promotion-dialog.css";
import "../cm-chessboard/assets/extensions/arrows/arrows.css";

export const CUSTOM_MARKER_TYPE = {
  checkmark: {
    class: "marker-checkmark",
    slice: "markerCheckmark",
  },
  cancel: {
    class: "marker-cancel",
    slice: "markerCancel",
  },
  squareGreen: {
    class: "marker-square-green",
    slice: "markerSquare",
  },
  squareRed: {
    class: "marker-square-red",
    slice: "markerSquare",
  },
};

export const BOARD_STATUS = {
  default: "default",
  waitingOnMove: "waitingOnMove",
  animatingMoves: "animatingMoves",
};

export const BOARD_SETTINGS = {
  variations: "useVariations",
  premoves: "premoveEnabled",
  navigation: "navigationEnabled",
  pgn: {
    links: "pgn.withLinks",
    styling: {
      main: {
        default: "pgn.styling.main",
        text: "pgn.styling.mainText",
        link: "pgn.styling.mainLink",
      },
    },
  },
};

export const PIECE_TILESIZE = {
  default: 40,
  alpha: 2048,

  get(str) {
    // strip the basename
    var base = new String(str).substring(str.lastIndexOf("/") + 1);
    if (base.lastIndexOf(".") != -1)
      base = base.substring(0, base.lastIndexOf("."));

    return PIECE_TILESIZE[base] ? PIECE_TILESIZE[base] : this.default;
  },
};

/*
MyChessBoard Class - Integrates Chess.js with cm-chessboard, validates moves, adds markers, etc.
*/
export class MyChessBoard {
  board = null;
  game = null;

  status = BOARD_STATUS.default;
  premoves = [];

  boardSettings = {
    useVariations: true,
    premoveEnabled: false,
    navigationEnabled: false, // enable prev/next by using left/right arrow keys
    pgn: {
      withLinks: true,
      styling: {
        main: "",
        mainText: "pgn-text",
        mainLink: "pgn-move",
        variation: "is-variation",
        variationText: "pgn-text",
        variationLink: "pgn-move",
        currentMove: "current-move",
        moveNumber: "move-number",
      },
    },
  };

  pgnField = null;

  initialFen = "";
  currentMove = 0;
  currentVariation = -1;

  history = [];
  variations = [];

  /*

  - keep track of complete history with variations
  - option to move back and forward through game

  - keep track of main line (user can just make moves playing around)
  - main line should be kept in tact
  - and you should be able to have a getMoves / history function for the main line ??

  - options: 
  - + useVariations = on new move, add variation or overwrite existing line
  - + keepMainLine = ? see above, probably the same setting?

  - newGame()
  - reset(?fen)
  - load(fen)
  - goBack(), goForward(), goFirst(), goLast()
  - makeMoves(moves)
  - jumpToMove(moveNr, variationNr)
  - getVariations()
  - getMainLine() ?

  - getPgn(withVariations = true)
  - getPgnLinks(withVariations = true)

  - currentFen()
  - currentLine() ?
  - currentVariation() ?

  */

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
    squareGreen: {
      class: "marker-square-green",
      slice: "markerSquare",
    },
    squareRed: {
      class: "marker-square-red",
      slice: "markerSquare",
    },
  };

  constructor() {
    // create the chess game
    this.game = new MyChess();

    // initialise the pgn field
    this.pgnField = new PgnField({ 
      container: null, 
      options: {
        navigationEnabled: true, 
        useVariations: true,
        withLinks: true
      },
      handlers: {
        onGotoMove: (moveNr, variationIdx, moves) => {
          
          console.log("-- Repertoire.js - onGotoMove:", moveNr, variationIdx, moves);

          this.gotoMove(moveNr, variationIdx, moves);
        }
      }
    });
  }

  /*
  Initialise the chessboard.

  @params:
  - boardElement: the container element for displaying the chessboard
  - color: the initial orientation of the chessboard.
  */

  init(boardElement, boardSettings = {}, settings = {}) {
    // the default board settings
    var _boardSettings = {
      position: FEN.start,
      orientation: COLOR.white,
      assetsUrl: "/assets/", // wherever you copied the assets folder to, could also be in the node_modules folder
      style: {
        cssClass: "chess-club", // set the css theme of the board, try "green", "blue" or "chess-club"
        showCoordinates: true, // show ranks and files
        aspectRatio: 1, // height/width of the board
        pieces: {
          file: "pieces/standard.svg", // the filename of the sprite in `assets/pieces/` or an absolute url like `https://…` or `/…`
        },
        animationDuration: 300, // pieces animation duration in milliseconds. Disable all animations with `0`
      },
      extensions: [
        {
          class: Markers,
          props: { sprite: "extensions/markers/markers.svg" },
        },
        {
          class: PromotionDialog,
          props: { sprite: "extensions/markers/arrows.svg" },
        },
        {
          class: ThickerArrows,
        },
      ],
    };
    // merge the custom board settings
    _boardSettings = this.deepMerge(_boardSettings, boardSettings);

    // create the chess board
    this.board = new Chessboard(boardElement, _boardSettings);

    // apply the chessboard settings (for this class, not the board itself)
    this.boardSettings = this.deepMerge(this.boardSettings, settings);
  }

  setOption(setting, value) {
    try {
      // get the (nested) setting keys
      var parts = setting.split(".");
      var temp = this.boardSettings;
      for (var i = 1; i < parts.length; i++) {
        temp = temp[parts[i - 1]];
      }
      // update the setting
      temp[parts[parts.length - 1]] = value;
    } catch (err) {
      console.warn(err);
    }
  }

  updatePgnField() {
    this.pgnField.updatePgnField();
  }

  deepMerge(obj1, obj2) {
    for (let key in obj2) {
      if (obj2.hasOwnProperty(key)) {
        if (obj2[key] instanceof Object && obj1[key] instanceof Object) {
          obj1[key] = this.deepMerge(obj1[key], obj2[key]);
        } else {
          obj1[key] = obj2[key];
        }
      }
    }
    return obj1;
  }

  // remove all markers, optionally excluding the premove marker
  removeMarkers(keepPremove = true) {
    this.board.removeMarkers(MARKER_TYPE.bevel);
    this.board.removeMarkers(MARKER_TYPE.circle);
    this.board.removeMarkers(MARKER_TYPE.circleDanger);
    this.board.removeMarkers(MARKER_TYPE.circlePrimary);
    this.board.removeMarkers(MARKER_TYPE.dot);
    this.board.removeMarkers(MARKER_TYPE.frame);
    this.board.removeMarkers(MARKER_TYPE.frameDanger);
    this.board.removeMarkers(MARKER_TYPE.framePrimary);
    this.board.removeMarkers(MARKER_TYPE.square);
    this.board.removeMarkers(CUSTOM_MARKER_TYPE.checkmark);
    this.board.removeMarkers(CUSTOM_MARKER_TYPE.cancel);
    this.board.removeMarkers(CUSTOM_MARKER_TYPE.squareGreen);
    if (!keepPremove) {
      this.board.removeMarkers(CUSTOM_MARKER_TYPE.squareRed);
    }
  }

  /*
  Public functions.
  */

  // enable move input
  enableMoveInput() {
    try {
      this.board.enableMoveInput(this.moveInputHandler.bind(this));
    } catch (err) {
      console.warn(err);
    }
  }

  // disable move input
  disableMoveInput() {
    try {
      this.board.disableMoveInput();
    } catch (err) {
      console.warn(err);
    }
  }

  // get the correct FEN notation (en passant rule not included if not actually possible, should always be included if pawn moved 2 squares)
  getFen() {
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

  //
  async resetToPosition(
    initialFen,
    moves,
    resetMoves = false,
    updateBoard = true
  ) {

    console.log('Chessboard.js - resetToPosition', moves, resetMoves, updateBoard);

    // get the current moves
    var history = this.game.history({ verbose: true });
    var movesToMake = [];
    var movesThatMatch = [];

    //var match = initialFen == this.initialFen && moves.length >= history.length;
    var match = initialFen == this.initialFen && !resetMoves;
    var lastMatchingFen = "";

    // see if the current moves match the new moves
    for (var i = 0; i < moves.length; i++) {
      // if this is a new move
      if (match == false || i >= history.length) {
        movesToMake.push(moves[i]);
      } else if (moves[i] !== history[i].san) {
        movesToMake.push(moves[i]);
        // not a match, stop checking
        match = false;
        //break;
      } else if (match) {
        //lastMatchingFen = history[i].after;
        movesThatMatch.push(moves[i]);
      }
    }

    // if a match, but current history has more moves
    if (match && history.length > moves.length) {
      match = false;
    }

    // reset the game & board
    if (!match) {
      try {
        // if we have an initial fen
        if (initialFen != "") {
          this.game.load(initialFen);
        } else {
          this.game.reset();
        }
        // make the moves that matched
        for (var i = 0; i < movesThatMatch.length; i++) {
          this.game.move(movesThatMatch[i]);
        }
        // update the board
        if (updateBoard) {
          // animate the moves if it's a new position
          await this.board.setPosition(
            this.game.fen(),
            movesThatMatch.length > 0
          );
        }

        //movesToMake = moves;
      } catch (err) {
        console.warn("Error:", err);
      }
    }

    // the new moves
    var newMoves = [];
    // make the (new) moves
    for (var i = moves.length - movesToMake.length; i < moves.length; i++) {
      this.game.move(moves[i]);
      newMoves.push(this.game.history({ verbose: true }).pop());
    }

    return newMoves;
  }

  // make a move
  makeMove(move) {
    try {
      // make the move
      this.game.move(move);
      // set the new position
      this.board.setPosition(this.game.fen());

      // add the move to our history with variations
      //this.pgnField.addMoveToHistory(this.game.history({ verbose: true }).pop());

      // in case of clicking back into a line and then clicking a different move (repertoire)
      // we need to reset to the current history
      this.pgnField.reset('', this.game.history({ verbose: true }));

      // process the move
      this.afterMakeMove();
      // call the after move event
      this.afterMove(move);
    } catch (err) {
      console.warn(err);
    }
  }

  // jump to a certain position
  jumpToMove(index) {
    try {

      //
      // we need to fix this one..
      //
      this.pgnField.resetTo(index);

      // get the history of moves
      var moves = this.game.history({ verbose: true });

      // undo the last X moves
      for (var i = 1; i < moves.length - index; i++) {
        this.game.undo();
      }

      /*
      // reset the game and make the moves
      this.game.reset();
      for (var i = 0; i <= index; i++) {
        this.game.move(moves[i].san);
      }
        */

      // set the board position
      this.board.setPosition(this.game.fen());

      // process the move
      this.afterMakeMove();
      // call the after move event
      this.afterMove(moves[index]);
    } catch (err) {
      console.warn(err);
    }
  }

  /**
   * history + variations
   */

  newGame(fen = "", moves = []) {
    // remember the initial FEN position
    this.initialFen = fen;
    // reset the game
    this.game.reset();
    if (fen != "") {
      this.game.load(fen);
    }
    this.board.setPosition(this.game.fen());

    // reset the pgn field
    this.pgnField.reset();
  }

  resetToCurrent(fen = "") {
    this.initialFen = fen;

    console.log('Chessboard.js - resetToCurrent', fen);
    
    //
    // maybe pass moves here?? to make sure its synchronized ??
    //

    //this.history = this.game.history({ verbose: true });

    // reset the pgn field to this the current history
    this.pgnField.resetToCurrent(fen, this.game.history({ verbose: true }));
  }

  gameMove(move) {
    //
    this.game.move(move);
    //
    this.pgnField.addMoveToHistory(move);
  }

  gameUndo() {
    // undo the move
    this.game.undo();
    // update the board
    this.board.setPosition(this.game.fen());

    // 
    this.pgnField.removeLast();
  }

  addVariation(moveNr, moves) {
    return this.pgnField.addVariation(moveNr, moves);
  }

  gotoMove(moveNr, variationIdx = -1, moves = []) {

    //
    // get the moves from pgn-field ??
    //

    // reset to position (need to use diff function for this later..)
    this.resetToPosition(this.initialFen, moves, false, false);
    // update the board
    this.board.setPosition(this.game.fen());
    // process the move
    this.afterMakeMove();
    // update the PGN field
    this.updatePgnField();

    // call the afterGotoMove handler
    this.afterGotoMove(moveNr, variationIdx);

    return true;
  }

  // functions to pass through to PgnField
  isFirst() {
    return this.pgnField.isFirst();
  }

  isLast() {
    return this.pgnField.isLast();
  }

  gotoFirst() {
    console.log('Chessboard.js - gotoFirst', this.pgnField);

    this.pgnField.gotoFirst()
  }

  gotoLast() {
    this.pgnField.gotoLast();
  }

  gotoPrevious() {
    this.pgnField.gotoPrevious();
  }

  gotoNext() {
    this.pgnField.gotoNext();
  }

  addMoveToHistory(move) {
    return this.pgnField.addMoveToHistory(move);
  }

  // set the PgnField container
  setPgnField(element) {
    //this.pgnField = element;

    // update the pgn field container
    this.pgnField.setContainer(element);

  }

  setPgnWithLinks(toggle = true) {
    this.boardSettings.pgn.withLinks = toggle;

    //
    this.pgnField.setPgnWithLinks(toggle);

    // update the pgn field
    this.updatePgnField();
  }

  getHistoryMove(moveNr) {
    var moves = [];

    // add the main line move
    if (this.history.length >= moveNr) {
      moves.push(this.history[moveNr]);
    }

    // add the variations moves
    for (var i = 0; i < this.variations.length; í++) {
      if (
        this.variations[i].moveNr <= moveNr &&
        this.variations[i].moveNr + this.variations[i].moves.length >= moveNr
      ) {
        moves.push(
          this.variations[i].moves[moveNr - this.variations[i].moveNr]
        );
      }
    }

    return moves;
  }

  // update the board status
  setStatus(status) {
    this.status = status;

    // if we need to make a premove
    if (this.status == BOARD_STATUS.waitingOnMove && this.premoves.length > 0) {
      try {
        // remove the premove markers
        this.board.removeMarkers(CUSTOM_MARKER_TYPE.squareRed);

        // make the move
        this.makeMove({
          from: this.premoves[0].squareFrom,
          to: this.premoves[0].squareTo,
          promotion: this.premoves[0].promotion
            ? this.premoves[0].promotion
            : "q",
        });
        // remove the premove
        this.premoves.splice(0, 1);
        // remove the last move markers
        this.board.removeMarkers();

        // re-add next premove markers
        for (var i = 0; i < this.premoves.length; i++) {
          this.board.addMarker(
            CUSTOM_MARKER_TYPE.squareRed,
            this.premoves[i].squareFrom
          );
          this.board.addMarker(
            CUSTOM_MARKER_TYPE.squareRed,
            this.premoves[i].squareTo
          );
        }
      } catch (err) {
        console.warn(err);
        // clear the premoves
        this.premoves = [];
      }
    }
  }
  

  /*
  Public event handlers, override in extended class.
  - onValidateMove: called when a legal move is being made, return false to cancel the move
  - afterMove: called after a legal move was made
  - afterIllegalMove: called after an illegal move was made
  - afterGotoMove: called after one of these functions is called: gotoFirst, gotoLast, gotoNext, gotoPrevious, gotoMove
  */
  onValidateMove(move) {
    return true;
  }

  afterMove(move) { }

  afterIllegalMove(move) { }

  afterGotoMove(moveNr, variationIdx) { }

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

    // if this is a premove
    if (this.status !== BOARD_STATUS.waitingOnMove) {
      // add a marker
      this.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, event.squareFrom);

      return true;
    }

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
    //this.board.addLegalMovesMarkers(moves);

    return true;
  }

  validateMoveInput(event) {
    try {
      //
      // if waiting on move, do as below -> check turn and rank
      // if not waiting (=premove) -> check color (orientation) and rank
      //

      // if this is a promotion
      if (
        ((this.game.turn() === "b" && event.squareTo.charAt(1) === "1") ||
          (this.game.turn() === "w" && event.squareTo.charAt(1) === "8")) &&
        event.piece.charAt(1) === "p"
      ) {
        // show the promotion dialog
        this.board.showPromotionDialog(
          event.squareTo,
          this.game.turn() === "w" ? COLOR.white : COLOR.black,
          (result) => {
            if (result && result.piece) {
              // if this is a premove
              if (this.status !== BOARD_STATUS.waitingOnMove) {
                // add the premove
                var temp = event;
                temp.promotion = result.piece.charAt(1);
                this.premoves.push(temp);
                // remove any markers before adding the premove markers
                this.board.removeMarkers(undefined, event.squareFrom);
                this.board.removeMarkers(undefined, event.squareTo);
                this.board.addMarker(
                  CUSTOM_MARKER_TYPE.squareRed,
                  event.squareFrom
                );
                this.board.addMarker(
                  CUSTOM_MARKER_TYPE.squareRed,
                  event.squareTo
                );
              } else {
                //chessboard.setPiece(result.square, result.piece, true);
                // make the move
                this.makeMove({
                  from: event.squareFrom,
                  to: event.squareTo,
                  promotion: result.piece.charAt(1),
                });
              }
            } else {
              //chessboard.setPosition(position);
            }
          }
        );

        // return false here, cancelling the move, on dialog result, we make the move.. if not, move is already cancelled
        return false;
      }

      // if this is a premove
      if (this.status !== BOARD_STATUS.waitingOnMove) {
        this.premoves.push(event);

        // remove any markers before adding the premove markers
        this.board.removeMarkers(undefined, event.squareFrom);
        this.board.removeMarkers(undefined, event.squareTo);
        this.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, event.squareFrom);
        this.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, event.squareTo);

        return false;
      }

      // see if the move is legal
      var move = this.game.move({
        from: event.squareFrom,
        to: event.squareTo,
        promotion: "q", // NOTE: always promote to a queen for example simplicity
      });

      if (this.onValidateMove(move)) {
        // set the board position
        this.board.setPosition(this.game.fen());

        // add the move to our history with variations
        this.pgnField.addMoveToHistory(this.game.history({ verbose: true }).pop());

        console.log('Chessboard.js - added move to pgnfield history, after..', this.game.history());

        return true;
      } else {
        // undo the move
        this.game.undo();

        return false;
      }
    } catch (err) {
      console.warn(err);

      return false;
    }
  }

  moveInputCancelled(event) {
    // if we have a premove
    if (this.premoves.length > 0) {
      this.premoves = [];
    }
    // remove the premove markers
    this.board.removeMarkers(CUSTOM_MARKER_TYPE.squareRed);
    // remove the legal move markers
    this.board.removeLegalMovesMarkers();
  }

  moveInputFinished(event) {
    // remove the legal move markers
    this.board.removeLegalMovesMarkers();
    // if this was an actual move
    if (event.squareFrom && event.squareTo) {
      // if this is a premove
      if (this.status !== BOARD_STATUS.waitingOnMove) {
        this.premoves.push(event);

        // remove any markers before adding the premove markers
        this.board.removeMarkers(undefined, event.squareFrom);
        this.board.removeMarkers(undefined, event.squareTo);
        this.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, event.squareFrom);
        this.board.addMarker(CUSTOM_MARKER_TYPE.squareRed, event.squareTo);

        return true;
      }

      // process the move
      this.afterMakeMove();
      // if this was a legal move
      if (event.legalMove) {
        // call the after move event
        this.afterMove(this.game.history({ verbose: true }).pop());
      }
    }
  }

  // called after a move was made
  afterMakeMove(removeMarkers = true) {
    // remove the legal move markers
    this.board.removeLegalMovesMarkers();

    if (removeMarkers) {
      this.board.removeMarkers();
    }

    // get the last move
    var last = this.game.history({ verbose: true }).pop();

    // add marker for last move
    if (last) {
      this.board.addMarker(MARKER_TYPE.square, last.from);
      this.board.addMarker(MARKER_TYPE.square, last.to);
    }
  }
}
