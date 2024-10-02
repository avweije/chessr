<?php

namespace App\Entity\Main;

use App\Config\DownloadSite;
use App\Repository\SettingsRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: SettingsRepository::class)]
class Settings
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\OneToOne(inversedBy: 'settings', cascade: ['persist', 'remove'])]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $User = null;

    #[ORM\Column(nullable: true, enumType: DownloadSite::class)]
    private ?DownloadSite $Site = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $ChessUsername = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $LichessUsername = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $Board = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $Pieces = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private ?int $Animation = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->User;
    }

    public function setUser(User $User): static
    {
        $this->User = $User;

        return $this;
    }

    public function getSite(): ?DownloadSite
    {
        return $this->Site;
    }

    public function setSite(?DownloadSite $Site): static
    {
        $this->Site = $Site;

        return $this;
    }

    public function getChessUsername(): ?string
    {
        return $this->ChessUsername;
    }

    public function setChessUsername(?string $ChessUsername): static
    {
        $this->ChessUsername = $ChessUsername;

        return $this;
    }

    public function getLichessUsername(): ?string
    {
        return $this->LichessUsername;
    }

    public function setLichessUsername(?string $LichessUsername): static
    {
        $this->LichessUsername = $LichessUsername;

        return $this;
    }

    public function getBoard(): ?string
    {
        return $this->Board;
    }

    public function setBoard(?string $Board): static
    {
        $this->Board = $Board;

        return $this;
    }

    public function getPieces(): ?string
    {
        return $this->Pieces;
    }

    public function setPieces(?string $Pieces): static
    {
        $this->Pieces = $Pieces;

        return $this;
    }

    public function getAnimation(): ?int
    {
        return $this->Animation;
    }

    public function setAnimation(int $Animation): static
    {
        $this->Animation = $Animation;

        return $this;
    }
}
