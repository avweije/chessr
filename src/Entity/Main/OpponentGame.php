<?php

namespace App\Entity\Main;

use App\Repository\Main\OpponentGameRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: OpponentGameRepository::class)]
class OpponentGame
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'Games')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Opponent $Opponent = null;

    #[ORM\Column(length: 5)]
    private ?string $Color = null;

    #[ORM\Column(length: 5)]
    private ?string $Result = null;

    #[ORM\Column(length: 2048)]
    private ?string $Pgn = null;

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

    public function getResult(): ?string
    {
        return $this->Result;
    }

    public function setResult(string $Result): static
    {
        $this->Result = $Result;

        return $this;
    }

    public function getPgn(): ?string
    {
        return $this->Pgn;
    }

    public function setPgn(string $Pgn): static
    {
        $this->Pgn = strlen($Pgn) > 2048 ? substr($Pgn, 0, 2048) : $Pgn;

        return $this;
    }
}
