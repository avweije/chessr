<?php

namespace App\Entity\Main;

use App\Config\DownloadSite;
use App\Config\DownloadStatus;
use App\Repository\DownloadsRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: DownloadsRepository::class)]
class Downloads
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

    #[ORM\Column]
    private ?int $Year = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private ?int $Month = null;

    #[ORM\Column(length: 20)]
    private ?string $Type = null;

    #[ORM\Column(enumType: DownloadStatus::class)]
    private ?DownloadStatus $Status = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    private ?\DateTimeInterface $DateTime = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $LastUUID = null;

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

    public function getMonth(): ?int
    {
        return $this->Month;
    }

    public function setMonth(int $Month): static
    {
        $this->Month = $Month;

        return $this;
    }

    public function getType(): ?string
    {
        return $this->Type;
    }

    public function setType(string $Type): static
    {
        $this->Type = $Type;

        return $this;
    }

    public function getStatus(): ?DownloadStatus
    {
        return $this->Status;
    }

    public function setStatus(DownloadStatus $Status): static
    {
        $this->Status = $Status;

        return $this;
    }

    public function getDateTime(): ?\DateTimeInterface
    {
        return $this->DateTime;
    }

    public function setDateTime(\DateTimeInterface $DateTime): static
    {
        $this->DateTime = $DateTime;

        return $this;
    }

    public function getLastUUID(): ?string
    {
        return $this->LastUUID;
    }

    public function setLastUUID(?string $LastUUID): static
    {
        $this->LastUUID = $LastUUID;

        return $this;
    }
}
