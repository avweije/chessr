<?php

namespace App\Entity;

use App\Repository\ECORepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ECORepository::class)]
class ECO
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 3)]
    private ?string $Code = null;

    #[ORM\Column(length: 255)]
    private ?string $Name = null;

    #[ORM\Column(length: 255)]
    private ?string $PGN = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCode(): ?string
    {
        return $this->Code;
    }

    public function setCode(string $Code): static
    {
        $this->Code = $Code;

        return $this;
    }

    public function getName(): ?string
    {
        return $this->Name;
    }

    public function setName(string $Name): static
    {
        $this->Name = $Name;

        return $this;
    }

    public function getPGN(): ?string
    {
        return $this->PGN;
    }

    public function setPGN(string $PGN): static
    {
        $this->PGN = $PGN;

        return $this;
    }
}
