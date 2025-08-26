<?php

namespace App\Entity;

use App\Config\DownloadSite;
use App\Repository\SettingsRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: SettingsRepository::class)]
class Settings
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column(type: 'integer')]
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
    private ?int $AnimationDuration = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private ?int $AnimateVariation = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private ?int $RepertoireEngineTime = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private ?int $AnalyseEngineTime = null;

    #[ORM\Column]
    private ?bool $AnalyseIgnoreInaccuracy = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private ?int $RecommendInterval = null;

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

    public function getAnimationDuration(): ?int
    {
        return $this->AnimationDuration;
    }

    public function setAnimationDuration(int $AnimationDuration): static
    {
        $this->AnimationDuration = $AnimationDuration;

        return $this;
    }

    public function getAnimateVariation(): ?int
    {
        return $this->AnimateVariation;
    }

    public function setAnimateVariation(int $AnimateVariation): static
    {
        $this->AnimateVariation = $AnimateVariation;

        return $this;
    }

    public function getRepertoireEngineTime(): ?int
    {
        return $this->RepertoireEngineTime;
    }

    public function setRepertoireEngineTime(int $RepertoireEngineTime): static
    {
        $this->RepertoireEngineTime = $RepertoireEngineTime;

        return $this;
    }

    public function getAnalyseEngineTime(): ?int
    {
        return $this->AnalyseEngineTime;
    }

    public function setAnalyseEngineTime(int $AnalyseEngineTime): static
    {
        $this->AnalyseEngineTime = $AnalyseEngineTime;

        return $this;
    }

    public function isAnalyseIgnoreInaccuracy(): ?bool
    {
        return $this->AnalyseIgnoreInaccuracy;
    }

    public function setAnalyseIgnoreInaccuracy(bool $AnalyseIgnoreInaccuracy): static
    {
        $this->AnalyseIgnoreInaccuracy = $AnalyseIgnoreInaccuracy;

        return $this;
    }

    public function getRecommendInterval(): ?int
    {
        return $this->RecommendInterval;
    }

    public function setRecommendInterval(int $RecommendInterval): static
    {
        $this->RecommendInterval = $RecommendInterval;

        return $this;
    }
}
