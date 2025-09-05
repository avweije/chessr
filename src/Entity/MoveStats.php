<?php

namespace App\Entity;

use App\Repository\MoveStatsRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: MoveStatsRepository::class)]
#[ORM\Table(name: 'move_stats')]
#[ORM\UniqueConstraint(name: 'uniq_fen_move', columns: ['fen_id', 'move'])]
class MoveStats
{
    #[ORM\Id]
    #[ORM\ManyToOne(targetEntity: Fen::class)]
    #[ORM\JoinColumn(name: 'fen_id', referencedColumnName: 'id', onDelete: 'CASCADE')]
    private ?Fen $fen = null;

    #[ORM\Id]
    #[ORM\Column(length: 10)]
    private ?string $move = null;

    #[ORM\Column(type: 'integer')]
    private ?int $wins = null;

    #[ORM\Column(type: 'integer')]
    private ?int $draws = null;

    #[ORM\Column(type: 'integer')]
    private ?int $losses = null;

    public function getFen(): ?Fen
    {
        return $this->fen;
    }

    public function setFen(Fen $fen): static
    {
        $this->fen = $fen;
        return $this;
    }

    public function getMove(): ?string
    {
        return $this->move;
    }

    public function setMove(string $move): static
    {
        $this->move = $move;
        return $this;
    }
    
    public function getWins(): ?int
    {
        return $this->wins;
    }

    public function setWins(int $wins): static
    {
        $this->wins = $wins;
        return $this;
    }

    public function getDraws(): ?int
    {
        return $this->draws;
    }

    public function setDraws(int $draws): static
    {
        $this->draws = $draws;
        return $this;
    }

    public function getLosses(): ?int
    {
        return $this->losses;
    }

    public function setLosses(int $losses): static
    {
        $this->losses = $losses;
        return $this;
    }
}