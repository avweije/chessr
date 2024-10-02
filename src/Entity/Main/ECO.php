<?php

namespace App\Entity\Main;

use App\Repository\ECORepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Ignore;
use Symfony\Component\Serializer\Annotation\SerializedName;

#[ORM\Entity(repositoryClass: ECORepository::class)]
class ECO
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Ignore]
    private ?int $id = null;

    #[ORM\Column(length: 3)]
    #[SerializedName('code')]
    private ?string $Code = null;

    #[ORM\Column(length: 255)]
    #[SerializedName('name')]
    private ?string $Name = null;

    #[ORM\Column(length: 255)]
    #[SerializedName('pgn')]
    private ?string $PGN = null;

    #[Ignore]
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
