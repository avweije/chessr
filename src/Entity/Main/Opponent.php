<?php

namespace App\Entity\Main;

use App\Config\DownloadSite;
use App\Repository\Main\OpponentRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: OpponentRepository::class)]
class Opponent
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private ?string $Username = null;

    #[ORM\Column(enumType: DownloadSite::class)]
    private ?DownloadSite $Site = null;

    #[ORM\Column]
    private ?int $Total = null;

    /**
     * @var Collection<int, OpponentGame>
     */
    #[ORM\OneToMany(targetEntity: OpponentGame::class, mappedBy: 'Opponent', orphanRemoval: true)]
    private Collection $Games;

    /**
     * @var Collection<int, OpponentMove>
     */
    #[ORM\OneToMany(targetEntity: OpponentMove::class, mappedBy: 'Opponent', orphanRemoval: true)]
    private Collection $Moves;

    #[ORM\ManyToOne(targetEntity: self::class)]
    private ?self $Parent = null;

    public function __construct()
    {
        $this->Games = new ArrayCollection();
        $this->Moves = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUsername(): ?string
    {
        return $this->Username;
    }

    public function setUsername(string $Username): static
    {
        $this->Username = $Username;

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

    public function getTotal(): ?int
    {
        return $this->Total;
    }

    public function setTotal(int $Total): static
    {
        $this->Total = $Total;

        return $this;
    }

    /**
     * @return Collection<int, OpponentGame>
     */
    public function getGames(): Collection
    {
        return $this->Games;
    }

    public function addGame(OpponentGame $game): static
    {
        if (!$this->Games->contains($game)) {
            $this->Games->add($game);
            $game->setOpponent($this);
        }

        return $this;
    }

    public function removeGame(OpponentGame $game): static
    {
        if ($this->Games->removeElement($game)) {
            // set the owning side to null (unless already changed)
            if ($game->getOpponent() === $this) {
                $game->setOpponent(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, OpponentMove>
     */
    public function getMoves(): Collection
    {
        return $this->Moves;
    }

    public function addMove(OpponentMove $move): static
    {
        if (!$this->Moves->contains($move)) {
            $this->Moves->add($move);
            $move->setOpponent($this);
        }

        return $this;
    }

    public function removeMove(OpponentMove $move): static
    {
        if ($this->Moves->removeElement($move)) {
            // set the owning side to null (unless already changed)
            if ($move->getOpponent() === $this) {
                $move->setOpponent(null);
            }
        }

        return $this;
    }

    public function getParent(): ?self
    {
        return $this->Parent;
    }

    public function setParent(?self $Parent): static
    {
        $this->Parent = $Parent;

        return $this;
    }
}
