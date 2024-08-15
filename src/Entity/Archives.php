<?php

namespace App\Entity;

use App\Config\DownloadSite;
use App\Repository\ArchivesRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ArchivesRepository::class)]
class Archives
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $User = null;

    #[ORM\Column(enumType: DownloadSite::class)]
    private ?DownloadSite $Site = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private ?int $Year = null;

    #[ORM\Column(length: 255)]
    private ?string $First = null;

    #[ORM\Column(length: 255)]
    private ?string $Last = null;

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

    public function getSite(): ?DownloadSite
    {
        return $this->Site;
    }

    public function setSite(DownloadSite $Site): static
    {
        $this->Site = $Site;

        return $this;
    }

    public function getYear(): ?int
    {
        return $this->Year;
    }

    public function setYear(int $Year): static
    {
        $this->Year = $Year;

        return $this;
    }

    public function getFirst(): ?string
    {
        return $this->First;
    }

    public function setFirst(string $First): static
    {
        $this->First = $First;

        return $this;
    }

    public function getLast(): ?string
    {
        return $this->Last;
    }

    public function setLast(string $Last): static
    {
        $this->Last = $Last;

        return $this;
    }
}
