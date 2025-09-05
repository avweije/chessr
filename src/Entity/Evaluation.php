<?php

namespace App\Entity;

use App\Repository\EvaluationRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: EvaluationRepository::class)]
#[ORM\Table(name: 'evaluation', schema: 'evaluations')]
#[ORM\UniqueConstraint(name: 'uniq_fen_rank', columns: ['fen_id', 'rank'])]
#[ORM\Index(columns: ['fen_id'], name: 'idx_evaluation_fen')]
class Evaluation
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Fen::class)]
    #[ORM\JoinColumn(name: 'fen_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private ?Fen $fen = null;

    #[ORM\Column(length: 10)]
    private ?string $uci = null;

    #[ORM\Column(length: 10)]
    private ?string $san = null;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $cp = null; // centipawn evaluation

    #[ORM\Column(type: 'smallint', nullable: true)]
    private ?int $mate = null; // mate in N moves (can be positive or negative)

    #[ORM\Column(type: 'smallint')]
    private ?int $rank = null; // 1 = best move, etc.

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $line = null;

    #[ORM\Column(type: 'smallint')]
    private ?int $depth = null; // search depth

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $knodes = null; // thousands of nodes searched

    #[ORM\Column(type: 'smallint', nullable: true)]
    private ?int $fidx = null; // import file index, optional

    #[ORM\Column(type: 'bigint', nullable: true)]
    private ?int $bytes = null; // import byte offset, optional

    // ------------------ Getters & Setters ------------------

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getFen(): ?Fen
    {
        return $this->fen;
    }

    public function setFen(Fen $fen): static
    {
        $this->fen = $fen;
        return $this;
    }

    public function getUci(): ?string
    {
        return $this->uci;
    }

    public function setUci(string $uci): static
    {
        $this->uci = $uci;
        return $this;
    }

    public function getSan(): ?string
    {
        return $this->san;
    }

    public function setSan(string $san): static
    {
        $this->san = $san;
        return $this;
    }

    public function getCp(): ?int
    {
        return $this->cp;
    }

    public function setCp(?int $cp): static
    {
        $this->cp = $cp;
        return $this;
    }

    public function getMate(): ?int
    {
        return $this->mate;
    }

    public function setMate(?int $mate): static
    {
        $this->mate = $mate;
        return $this;
    }

    public function getRank(): ?int
    {
        return $this->rank;
    }

    public function setRank(int $rank): static
    {
        $this->rank = $rank;
        return $this;
    }

    public function getLine(): ?string
    {
        return $this->line;
    }

    public function setLine(?string $line): static
    {
        $this->line = $line;
        return $this;
    }

    public function getDepth(): ?int
    {
        return $this->depth;
    }

    public function setDepth(int $depth): static
    {
        $this->depth = $depth;
        return $this;
    }

    public function getKnodes(): ?int
    {
        return $this->knodes;
    }

    public function setKnodes(?int $knodes): static
    {
        $this->knodes = $knodes;
        return $this;
    }

    public function getFidx(): ?int
    {
        return $this->fidx;
    }

    public function setFidx(?int $fidx): static
    {
        $this->fidx = $fidx;
        return $this;
    }

    public function getBytes(): ?int
    {
        return $this->bytes;
    }

    public function setBytes(?int $bytes): static
    {
        $this->bytes = $bytes;
        return $this;
    }
}
