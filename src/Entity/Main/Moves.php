<?php

namespace App\Entity\Main;

use App\Repository\MovesRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: MovesRepository::class)]
#[ORM\Index(columns: ['fen'], name: 'idx_moves_fen')]
class Moves
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private ?string $Fen = null;

    #[ORM\Column(length: 10)]
    private ?string $Move = null;

    #[ORM\Column]
    private ?int $Wins = null;

    #[ORM\Column]
    private ?int $Draws = null;

    #[ORM\Column]
    private ?int $Losses = null;

    public function getId(): ?int
    {
        return $this->id;
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
}
