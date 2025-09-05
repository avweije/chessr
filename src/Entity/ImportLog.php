<?php

namespace App\Entity;

use App\Repository\ImportLogRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ImportLogRepository::class)]
#[ORM\Table(name: 'import_log')]
class ImportLog
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 255)]
    private ?string $filename = null;

    #[ORM\Column(type: 'bigint', options: ["default" => 0])]
    private ?int $bytesRead = 0;

    #[ORM\Column(type: 'integer', options: ["default" => 0])]
    private ?int $linesRead = 0;

    #[ORM\Column(type: 'integer', options: ["default" => 0])]
    private ?int $gamesRead = 0;

    #[ORM\Column(type: 'boolean', options: ["default" => false])]
    private bool $finished = false;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getFilename(): ?string
    {
        return $this->filename;
    }

    public function setFilename(string $filename): static
    {
        $this->filename = $filename;
        return $this;
    }

    public function getBytesRead(): ?int
    {
        return $this->bytesRead;
    }

    public function setBytesRead(int $bytesRead): static
    {
        $this->bytesRead = $bytesRead;
        return $this;
    }

    public function getLinesRead(): ?int
    {
        return $this->linesRead;
    }

    public function setLinesRead(int $linesRead): static
    {
        $this->linesRead = $linesRead;
        return $this;
    }

    public function getGamesRead(): ?int
    {
        return $this->gamesRead;
    }

    public function setGamesRead(int $gamesRead): static
    {
        $this->gamesRead = $gamesRead;
        return $this;
    }
    
    public function isFinished(): bool
    {
        return $this->finished;
    }

    public function setFinished(bool $finished): static
    {
        $this->finished = $finished;
        return $this;
    }
}
