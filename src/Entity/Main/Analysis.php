<?php

namespace App\Entity\Main;

use App\Repository\AnalysisRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: AnalysisRepository::class)]
class Analysis
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $User = null;

    #[ORM\Column(length: 255)]
    private ?string $White = null;

    #[ORM\Column(length: 255)]
    private ?string $Black = null;

    #[ORM\Column(length: 255)]
    private ?string $Link = null;

    #[ORM\Column(length: 10)]
    private ?string $Type = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $Fen = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $Pgn = null;

    #[ORM\Column(length: 10)]
    private ?string $Move = null;

    #[ORM\Column(length: 1024)]
    private ?string $BestMoves = null;

    #[ORM\Column(length: 255)]
    private ?string $InitialFen = null;

    #[ORM\Column(length: 5)]
    private ?string $color = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->User;
    }

    public function setUser(?User $User): static
    {
        $this->User = $User;

        return $this;
    }

    public function getWhite(): ?string
    {
        return $this->White;
    }

    public function setWhite(string $White): static
    {
        $this->White = $White;

        return $this;
    }

    public function getBlack(): ?string
    {
        return $this->Black;
    }

    public function setBlack(string $Black): static
    {
        $this->Black = $Black;

        return $this;
    }

    public function getLink(): ?string
    {
        return $this->Link;
    }

    public function setLink(string $Link): static
    {
        $this->Link = $Link;

        return $this;
    }

    public function getType(): ?string
    {
        return $this->Type;
    }

    public function setType(string $Type): static
    {
        $this->Type = $Type;

        return $this;
    }

    public function getFen(): ?string
    {
        return $this->Fen;
    }

    public function setFen(?string $Fen): static
    {
        $this->Fen = $Fen;

        return $this;
    }

    public function getPgn(): ?string
    {
        return $this->Pgn;
    }

    public function setPgn(?string $Pgn): static
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

    public function getBestMoves(): ?string
    {
        return $this->BestMoves;
    }

    public function setBestMoves(string $BestMoves): static
    {
        $this->BestMoves = $BestMoves;

        return $this;
    }

    public function getInitialFen(): ?string
    {
        return $this->InitialFen;
    }

    public function setInitialFen(string $InitialFen): static
    {
        $this->InitialFen = $InitialFen;

        return $this;
    }

    public function getColor(): ?string
    {
        return $this->color;
    }

    public function setColor(string $color): static
    {
        $this->color = $color;

        return $this;
    }
}
