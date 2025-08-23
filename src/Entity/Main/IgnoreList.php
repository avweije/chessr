<?php

namespace App\Entity\Main;

use App\Repository\IgnoreListRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: IgnoreListRepository::class)]
class IgnoreList
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $User = null;

    #[ORM\Column(length: 255)]
    private ?string $Fen = null;

    #[ORM\Column(length: 10)]
    private ?string $Move = null;

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
}
