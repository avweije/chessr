<?php

namespace App\Entity;

use App\Repository\EvaluationRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: EvaluationRepository::class)]
#[ORM\Table(schema: 'evaluations')]
#[ORM\Index(columns: ['fen'], name: 'idx_evaluation_fen')]
class Evaluation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    //#[ORM\Column(type: 'varbinary', length: 255)]
    #[ORM\Column(length: 255)]
    private ?string $Fen = null;

    #[ORM\Column(length: 8192)]
    private ?string $Evals = null;

    #[ORM\Column(type: 'bigint', nullable: true)]
    private int $bytes;

    #[ORM\Column(type: 'smallint', nullable: true)]
    private int $fidx;

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

    public function getEvals(): ?string
    {
        return $this->Evals;
    }

    public function setEvals(string $Evals): static
    {
        $this->Evals = $Evals;

        return $this;
    }

    public function getBytes(): int
    {
        return $this->bytes;
    }

    public function setBytes(int $bytes): self
    {
        $this->bytes = $bytes;
        return $this;
    }

    public function getFidx(): int
    {
        return $this->fidx;
    }

    public function setFidx(int $fidx): self
    {
        $this->fidx = $fidx;
        return $this;
    }
}
