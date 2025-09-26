<?php

namespace App\Entity;

use App\Repository\RepertoireRepository;
use DateTimeInterface;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RepertoireRepository::class)]
class Repertoire
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'repertoires')]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $User = null;

    #[ORM\Column(length: 10)]
    private ?string $Color = null;

    #[ORM\Column(length: 255)]
    private ?string $FenBefore = null;

    #[ORM\Column(length: 255)]
    private ?string $FenAfter = null;

    #[ORM\Column(length: 1024)]
    private ?string $Pgn = null;

    #[ORM\Column(length: 10)]
    private ?string $Move = null;

    #[ORM\Column]
    private ?int $HalfMove = null;

    #[ORM\Column(length: 255)]
    private ?string $InitialFen = null;

    #[ORM\Column(options: ['default' => false])]
    private ?bool $AutoPlay = null;

    #[ORM\Column(options: ['default' => false])]
    private ?bool $Exclude = null;

    #[ORM\Column(options: ['default' => false])]
    private ?bool $Focused = null;

    #[ORM\ManyToOne(targetEntity: Repertoire::class)]
    private ?Repertoire $FocusedParent = null;

    #[ORM\Column(length: 1024, nullable: true)]
    private ?string $Notes = null;

    #[ORM\Column(options: ['default' => 0])]
    private ?int $PracticeCount = null;

    #[ORM\Column(options: ['default' => 0])]
    private ?int $PracticeFailed = null;

    #[ORM\Column(options: ['default' => 0])]
    private ?int $PracticeInARow = null;

    #[ORM\Column(type: Types::DATE_MUTABLE, nullable: true)]
    private ?DateTimeInterface $LastUsed = null;

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $deltas = null;

    /**
     * @var Collection<int, RepertoireGroup>
     */
    #[ORM\OneToMany(targetEntity: RepertoireGroup::class, mappedBy: 'Repertoire', orphanRemoval: true)]
    private Collection $repertoireGroups;

    public function __construct()
    {
        $this->repertoireGroups = new ArrayCollection();
    }

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

    public function getColor(): ?string
    {
        return $this->Color;
    }

    public function setColor(string $Color): static
    {
        $this->Color = $Color;

        return $this;
    }

    public function getFenBefore(): ?string
    {
        return $this->FenBefore;
    }

    public function setFenBefore(string $FenBefore): static
    {
        $this->FenBefore = $FenBefore;

        return $this;
    }

    public function getFenAfter(): ?string
    {
        return $this->FenAfter;
    }

    public function setFenAfter(string $FenAfter): static
    {
        $this->FenAfter = $FenAfter;

        return $this;
    }

    public function getPgn(): ?string
    {
        return $this->Pgn;
    }

    public function setPgn(string $Pgn): static
    {
        $this->Pgn = $Pgn;

        return $this;
    }

    public function getMove(): ?string
    {
        return $this->Move;
    }

    public function setMove(string $Move): static
    {
        $this->Move = $Move;

        return $this;
    }

    public function getHalfMove(): ?int
    {
        return $this->HalfMove;
    }

    public function setHalfMove(int $HalfMove): static
    {
        $this->HalfMove = $HalfMove;

        return $this;
    }

    public function getInitialFen(): ?string
    {
        return $this->InitialFen;
    }

    public function setInitialFen(string $InitialFen): static
    {
        $this->InitialFen = $InitialFen;

        return $this;
    }

    public function isAutoPlay(): ?bool
    {
        return $this->AutoPlay;
    }

    public function setAutoPlay(bool $AutoPlay): static
    {
        $this->AutoPlay = $AutoPlay;

        return $this;
    }

    public function isExclude(): ?bool
    {
        return $this->Exclude;
    }

    public function setExclude(bool $Exclude): static
    {
        $this->Exclude = $Exclude;

        return $this;
    }

    public function isFocused(): ?bool
    {
        return $this->Focused;
    }

    public function setFocused(bool $Focused): static
    {
        $this->Focused = $Focused;

        return $this;
    }

    public function getFocusedParent(): ?Repertoire
    {
        return $this->FocusedParent;
    }

    public function setFocusedParent(?Repertoire $FocusedParent): static
    {
        $this->FocusedParent = $FocusedParent;
        return $this;
    }

    public function getNotes(): ?string
    {
        return $this->Notes;
    }

    public function setNotes(string $Notes): static
    {
        $this->Notes = $Notes;

        return $this;
    }

    public function getPracticeCount(): ?int
    {
        return $this->PracticeCount;
    }

    public function setPracticeCount(int $PracticeCount): static
    {
        $this->PracticeCount = $PracticeCount;

        return $this;
    }

    public function getPracticeFailed(): ?int
    {
        return $this->PracticeFailed;
    }

    public function setPracticeFailed(int $PracticeFailed): static
    {
        $this->PracticeFailed = $PracticeFailed;

        return $this;
    }

    public function getPracticeInARow(): ?int
    {
        return $this->PracticeInARow;
    }

    public function setPracticeInARow(int $PracticeInARow): static
    {
        $this->PracticeInARow = $PracticeInARow;

        return $this;
    }

    public function getLastUsed(): ?\DateTimeInterface
    {
        return $this->LastUsed;
    }

    public function setLastUsed(\DateTimeInterface $LastUsed): static
    {
        $this->LastUsed = $LastUsed;

        return $this;
    }

    public function getDeltas(): ?array
    {
        return $this->deltas;
    }

    public function setDeltas(?array $deltas): self
    {
        $this->deltas = $deltas;
        return $this;
    }

    // --- New helper to add a delta ---
    public function addDelta(int $delta, int $max = 10): self
    {
        $current = $this->deltas ?? [];
        $current[] = $delta;

        // Keep only the last $max deltas
        if (count($current) > $max) {
            $current = array_slice($current, -$max);
        }

        $this->deltas = $current;
        return $this;
    }

    /**
     * @return Collection<int, RepertoireGroup>
     */
    public function getRepertoireGroups(): Collection
    {
        return $this->repertoireGroups;
    }

    public function addRepertoireGroup(RepertoireGroup $repertoireGroup): static
    {
        if (!$this->repertoireGroups->contains($repertoireGroup)) {
            $this->repertoireGroups->add($repertoireGroup);
            $repertoireGroup->setRepertoire($this);
        }

        return $this;
    }

    public function removeRepertoireGroup(RepertoireGroup $repertoireGroup): static
    {
        if ($this->repertoireGroups->removeElement($repertoireGroup)) {
            // set the owning side to null (unless already changed)
            if ($repertoireGroup->getRepertoire() === $this) {
                $repertoireGroup->setRepertoire(null);
            }
        }

        return $this;
    }
}
