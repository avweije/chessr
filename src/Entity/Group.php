<?php

namespace App\Entity;

use App\Repository\GroupRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: GroupRepository::class)]
#[ORM\Table(name: '`group`')]
class Group
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 50)]
    private ?string $Name = null;

    /**
     * @var Collection<int, RepertoireGroup>
     */
    #[ORM\OneToMany(targetEntity: RepertoireGroup::class, mappedBy: 'Grp', orphanRemoval: true)]
    private Collection $repertoireGroups;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $User = null;

    public function __construct()
    {
        $this->repertoireGroups = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): ?string
    {
        return $this->Name;
    }

    public function setName(string $Name): static
    {
        $this->Name = $Name;

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
            $repertoireGroup->setGrp($this);
        }

        return $this;
    }

    public function removeRepertoireGroup(RepertoireGroup $repertoireGroup): static
    {
        if ($this->repertoireGroups->removeElement($repertoireGroup)) {
            // set the owning side to null (unless already changed)
            if ($repertoireGroup->getGrp() === $this) {
                $repertoireGroup->setGrp(null);
            }
        }

        return $this;
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
}
