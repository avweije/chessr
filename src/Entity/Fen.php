<?php

namespace App\Entity;

use App\Repository\FenRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: FenRepository::class)]
#[ORM\Table(name: 'fen')]
#[ORM\Index(columns: ['fen'], name: 'idx_fen_fen')]
class Fen
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(length: 255, unique: true)]
    private ?string $fen = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getFen(): ?string
    {
        return $this->fen;
    }

    public function setFen(string $fen): static
    {
        $this->fen = $fen;
        return $this;
    }
}