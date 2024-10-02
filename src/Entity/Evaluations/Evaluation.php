<?php

namespace App\Entity\Evaluations;

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
    #[ORM\Column(length: 255, options: ['collation' => 'utf8mb4_bin'])]
    private ?string $Fen = null;

    #[ORM\Column(length: 8192)]
    private ?string $Evals = null;

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
}
