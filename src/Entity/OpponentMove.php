<?php

namespace App\Entity;

use App\Repository\OpponentMoveRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: OpponentMoveRepository::class)]
class OpponentMove
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'Moves')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Opponent $Opponent = null;

    #[ORM\Column(length: 5)]
    private ?string $Color = null;

    #[ORM\Column(length: 255)]
    private ?string $Fen = null;

    #[ORM\Column(length: 1000, nullable: true)]
    private ?string $Pgn = null;

    #[ORM\Column(length: 10)]
    private ?string $Move = null;

    #[ORM\Column]
    private ?int $Wins = null;

    #[ORM\Column]
    private ?int $Draws = null;

    #[ORM\Column]
    private ?int $Losses = null;

    #[ORM\Column]
    private ?bool $Matches = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOpponent(): ?Opponent
    {
        return $this->Opponent;
    }

    public function setOpponent(?Opponent $Opponent): static
    {
        $this->Opponent = $Opponent;

        return $this;
    }

    public function getColor(): ?string
    {
        return $this->Color;
    }

    public function setColor(string $Color): static
    {
        $this->Color = $Color;

        return $this;
    }

    public function getFen(): ?string
    {
        return $this->Fen;
    }

    public function setFen(string $Fen): static
    {
        $this->Fen = $Fen;

        return $this;
    }

    public function getPgn(): ?string
    {
        return $this->Pgn;
    }

    public function setPgn(string $Pgn): static
    {
        $this->Pgn = $Pgn;

        return $this;
    }

    public function getMove(): ?string
    {
        return $this->Move;
    }

    public function setMove(string $Move): static
    {
        $this->Move = $Move;

        return $this;
    }

    public function getWins(): ?int
    {
        return $this->Wins;
    }

    public function setWins(int $Wins): static
    {
        $this->Wins = $Wins;

        return $this;
    }

    public function getDraws(): ?int
    {
        return $this->Draws;
    }

    public function setDraws(int $Draws): static
    {
        $this->Draws = $Draws;

        return $this;
    }

    public function getLosses(): ?int
    {
        return $this->Losses;
    }

    public function setLosses(int $Losses): static
    {
        $this->Losses = $Losses;

        return $this;
    }

    public function isMatches(): ?bool
    {
        return $this->Matches;
    }

    public function setMatches(bool $Matches): static
    {
        $this->Matches = $Matches;

        return $this;
    }
}
