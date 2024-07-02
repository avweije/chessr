<?php

namespace App\Entity;

use App\Repository\RepertoireRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RepertoireRepository::class)]
class Repertoire
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'repertoires')]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $User = null;

    #[ORM\Column(length: 10)]
    private ?string $Color = null;

    #[ORM\Column(length: 255)]
    private ?string $FenBefore = null;

    #[ORM\Column(length: 255)]
    private ?string $FenAfter = null;

    #[ORM\Column(length: 255)]
    private ?string $Pgn = null;

    #[ORM\Column(length: 10)]
    private ?string $Move = null;

    #[ORM\Column]
    private ?int $HalfMove = null;

    #[ORM\Column]
    private ?int $PracticeCount = null;

    #[ORM\Column]
    private ?int $PracticeFailed = null;

    #[ORM\Column]
    private ?int $PracticeInARow = null;

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

    public function getColor(): ?string
    {
        return $this->Color;
    }

    public function setColor(string $Color): static
    {
        $this->Color = $Color;

        return $this;
    }

    public function getFenBefore(): ?string
    {
        return $this->FenBefore;
    }

    public function setFenBefore(string $FenBefore): static
    {
        $this->FenBefore = $FenBefore;

        return $this;
    }

    public function getFenAfter(): ?string
    {
        return $this->FenAfter;
    }

    public function setFenAfter(string $FenAfter): static
    {
        $this->FenAfter = $FenAfter;

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

    public function getHalfMove(): ?int
    {
        return $this->HalfMove;
    }

    public function setHalfMove(int $HalfMove): static
    {
        $this->HalfMove = $HalfMove;

        return $this;
    }

    public function getPracticeCount(): ?int
    {
        return $this->PracticeCount;
    }

    public function setPracticeCount(int $PracticeCount): static
    {
        $this->PracticeCount = $PracticeCount;

        return $this;
    }

    public function getPracticeFailed(): ?int
    {
        return $this->PracticeFailed;
    }

    public function setPracticeFailed(int $PracticeFailed): static
    {
        $this->PracticeFailed = $PracticeFailed;

        return $this;
    }

    public function getPracticeInARow(): ?int
    {
        return $this->PracticeInARow;
    }

    public function setPracticeInARow(int $PracticeInARow): static
    {
        $this->PracticeInARow = $PracticeInARow;

        return $this;
    }
}
