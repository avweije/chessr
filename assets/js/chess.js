import { Chess } from "../chess.js/dist/esm/chess.js";

/*
MyChess Class - Adds historyWithCorrectFen to Chess.js.
*/
export class MyChess extends Chess {
  // get the history(verbose=true) with the corrent FEN's
  historyWithCorrectFen() {
    var updatedFen = "";
    // get the history
    var history = this.history({ verbose: true });
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
}
